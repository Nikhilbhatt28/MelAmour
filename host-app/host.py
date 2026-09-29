import asyncio
import json
import uuid
from fractions import Fraction

import numpy as np
import soundcard as sc
import websockets

from av import AudioFrame
from aiortc import (
    MediaStreamTrack,
    RTCPeerConnection,
    RTCSessionDescription,
)
from aiortc.contrib.media import MediaRelay

from config import (
    MELAMOUR_WS,
    ROOM_CODE,
    HOST_NAME,
    SAMPLE_RATE,
    CHANNELS,
    FRAME_SIZE,
)


# =========================================================
# CONFIG CHECK
# =========================================================

if ROOM_CODE == "CHANGE_ME":
    raise RuntimeError(
        "ROOM_CODE is still CHANGE_ME. "
        "Create a Melamour room first and put its code in config.py."
    )


# =========================================================
# HOST IDENTIFIER
# =========================================================

HOST_CLIENT_ID = f"HOST_CAPTURE_{uuid.uuid4().hex[:8]}"

peer_connections = {}

relay = MediaRelay()


# =========================================================
# SYSTEM AUDIO CAPTURE
# =========================================================

class SystemAudioTrack(MediaStreamTrack):
    kind = "audio"

    def __init__(self):
        super().__init__()

        speaker = sc.default_speaker()

        print(f"[AUDIO] Default speaker: {speaker.name}")

        self.loopback = sc.get_microphone(
            speaker.name,
            include_loopback=True
        )

        print(f"[AUDIO] Loopback device: {self.loopback}")

        self.recorder = self.loopback.recorder(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            blocksize=FRAME_SIZE
        )

        self.recorder.__enter__()

        self.timestamp = 0

        print("[AUDIO] Windows system-audio loopback started.")

    async def recv(self):

        data = await asyncio.to_thread(
            self.recorder.record,
            FRAME_SIZE
        )

        data = np.asarray(data, dtype=np.float32)

        # Ensure stereo
        if data.ndim == 1:
            data = np.column_stack((data, data))

        if data.shape[1] == 1:
            data = np.repeat(data, 2, axis=1)

        if data.shape[1] > 2:
            data = data[:, :2]

        # SoundCard returns frames x channels.
        # PyAV expects channels x samples.
        data = np.ascontiguousarray(data.T)

        frame = AudioFrame.from_ndarray(
            data,
            format="flt",
            layout="stereo"
        )

        frame.sample_rate = SAMPLE_RATE
        frame.pts = self.timestamp
        frame.time_base = Fraction(1, SAMPLE_RATE)

        self.timestamp += FRAME_SIZE

        return frame

    def stop(self):
        try:
            self.recorder.__exit__(None, None, None)
        except Exception:
            pass

        super().stop()


# =========================================================
# STOMP HELPERS
# =========================================================

def stomp_frame(command, headers=None, body=""):
    headers = headers or {}

    lines = [command]

    for key, value in headers.items():
        lines.append(f"{key}:{value}")

    lines.append("")
    lines.append(body)

    return "\n".join(lines) + "\x00"


def parse_stomp_frame(raw):

    if "\x00" in raw:
        raw = raw.split("\x00", 1)[0]

    parts = raw.split("\n\n", 1)

    header_part = parts[0]
    body = parts[1] if len(parts) > 1 else ""

    lines = header_part.split("\n")

    if not lines:
        return None, {}, body

    command = lines[0].strip()

    headers = {}

    for line in lines[1:]:
        if ":" in line:
            key, value = line.split(":", 1)
            headers[key] = value

    return command, headers, body


async def stomp_connect(ws):

    frame = stomp_frame(
        "CONNECT",
        {
            "accept-version": "1.2",
            "host": "localhost",
        }
    )

    await ws.send(frame)

    print("[STOMP] CONNECT sent.")

    while True:

        raw = await ws.recv()

        command, headers, body = parse_stomp_frame(raw)

        if command == "CONNECTED":
            print("[STOMP] Connected to Melamour server.")
            return

        if command == "ERROR":
            raise RuntimeError(
                f"STOMP ERROR: {body}"
            )


async def stomp_subscribe(ws):

    destination = f"/topic/room/{ROOM_CODE}"

    frame = stomp_frame(
        "SUBSCRIBE",
        {
            "id": "melamour-host",
            "destination": destination,
        }
    )

    await ws.send(frame)

    print(
        f"[STOMP] Subscribed to {destination}"
    )


async def stomp_send(ws, event):

    body = json.dumps(event)

    frame = stomp_frame(
        "SEND",
        {
            "destination": "/app/room",
            "content-type": "application/json",
        },
        body
    )

    await ws.send(frame)


# =========================================================
# WEBRTC
# =========================================================

async def create_peer_connection(
    ws,
    guest_client_id
):

    print(
        f"[WEBRTC] Creating connection for "
        f"{guest_client_id}"
    )

    pc = RTCPeerConnection()

    peer_connections[guest_client_id] = pc

    # Subscribe to the single system-audio source.
    audio_track = relay.subscribe(system_audio)

    pc.addTrack(audio_track)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():

        print(
            f"[WEBRTC] {guest_client_id} "
            f"state = {pc.connectionState}"
        )

        if pc.connectionState in [
            "failed",
            "closed",
            "disconnected",
        ]:

            try:
                await pc.close()
            except Exception:
                pass

            peer_connections.pop(
                guest_client_id,
                None
            )

    # Host creates offer.
    offer = await pc.createOffer()

    await pc.setLocalDescription(offer)

    print(
        f"[WEBRTC] Offer created for "
        f"{guest_client_id}"
    )

    await stomp_send(
        ws,
        {
            "type": "WEBRTC_OFFER",
            "roomCode": ROOM_CODE,
            "sender": HOST_CLIENT_ID,
            "role": "HOST_CAPTURE",
            "targetClientId": guest_client_id,
            "sdp": pc.localDescription.sdp,
            "sdpType": pc.localDescription.type,
        }
    )


async def handle_answer(event):

    guest_client_id = event.get("sender")

    pc = peer_connections.get(
        guest_client_id
    )

    if pc is None:
        print(
            f"[WEBRTC] No peer connection for "
            f"{guest_client_id}"
        )
        return

    sdp = event.get("sdp")

    if not sdp:
        print("[WEBRTC] Answer has no SDP.")
        return

    print(
        f"[WEBRTC] Applying answer from "
        f"{guest_client_id}"
    )

    await pc.setRemoteDescription(
        RTCSessionDescription(
            sdp=sdp,
            type=event.get(
                "sdpType",
                "answer"
            )
        )
    )

    print(
        f"[WEBRTC] Connected signaling with "
        f"{guest_client_id}"
    )


# =========================================================
# SERVER EVENTS
# =========================================================

async def handle_event(ws, event):

    event_type = event.get("type")

    sender = event.get("sender")

    target = event.get(
        "targetClientId"
    )

    # -----------------------------------------
    # Guest requests audio connection
    # -----------------------------------------

    if event_type == "WEBRTC_REQUEST":

        if target and target != HOST_CLIENT_ID:
            return

        if not sender:
            return

        print(
            f"[WEBRTC] Guest requested audio: "
            f"{sender}"
        )

        # Close previous connection if it exists.
        old_pc = peer_connections.get(sender)

        if old_pc:

            try:
                await old_pc.close()
            except Exception:
                pass

            peer_connections.pop(
                sender,
                None
            )

        await create_peer_connection(
            ws,
            sender
        )

        return

    # -----------------------------------------
    # Guest answer
    # -----------------------------------------

    if event_type == "WEBRTC_ANSWER":

        if target != HOST_CLIENT_ID:
            return

        await handle_answer(event)

        return

    # -----------------------------------------
    # Guest leaves
    # -----------------------------------------

    if event_type == "LEAVE_ROOM":

        if sender in peer_connections:

            pc = peer_connections.pop(
                sender,
                None
            )

            if pc:

                try:
                    await pc.close()
                except Exception:
                    pass

            print(
                f"[WEBRTC] Guest disconnected: "
                f"{sender}"
            )


# =========================================================
# STOMP LISTENER
# =========================================================

async def listen(ws):

    while True:

        raw = await ws.recv()

        if not isinstance(raw, str):
            continue

        command, headers, body = parse_stomp_frame(raw)

        if command == "MESSAGE":

            try:
                event = json.loads(body)

            except json.JSONDecodeError:

                print(
                    "[STOMP] Invalid JSON:"
                )

                print(body)

                continue

            await handle_event(
                ws,
                event
            )

        elif command == "ERROR":

            print(
                "[STOMP] Server error:"
            )

            print(body)


# =========================================================
# MAIN
# =========================================================

async def main():

    global system_audio

    print()
    print("=" * 55)
    print(" MELAMOUR HOST AUDIO")
    print("=" * 55)
    print(f" Room       : {ROOM_CODE}")
    print(f" Host       : {HOST_NAME}")
    print(f" Client ID  : {HOST_CLIENT_ID}")
    print("=" * 55)
    print()

    # Create system audio capture.
    system_audio = SystemAudioTrack()

    try:

        async with websockets.connect(
            MELAMOUR_WS,
            subprotocols=[
                "v12.stomp",
                "v11.stomp",
                "v10.stomp"
            ],
            max_size=None
        ) as ws:

            await stomp_connect(ws)

            await stomp_subscribe(ws)

            # Tell room that host audio capture is online.
            await stomp_send(
                ws,
                {
                    "type": "HOST_AUDIO_READY",
                    "roomCode": ROOM_CODE,
                    "sender": HOST_CLIENT_ID,
                    "role": "HOST_CAPTURE",
                    "message": "System audio capture ready"
                }
            )

            print()
            print(
                "[READY] Host audio capture is running."
            )
            print(
                "[READY] Waiting for guests..."
            )
            print()

            await listen(ws)

    finally:

        print(
            "[AUDIO] Stopping system audio..."
        )

        system_audio.stop()

        for pc in list(
            peer_connections.values()
        ):

            try:
                await pc.close()
            except Exception:
                pass

        peer_connections.clear()


if __name__ == "__main__":

    try:
        asyncio.run(main())

    except KeyboardInterrupt:

        print()
        print("[HOST] Stopped.")