import { useEffect, useRef, useState } from "react";

import {
  ArrowLeft,
  Copy,
  Headphones,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Send,
  Users,
  Volume2,
  Crown,
  LockKeyhole,
} from "lucide-react";

import { Client } from "@stomp/stompjs";

import "./Room.css";

const WS_URL = "wss://melamour-backend.onrender.com/ws";

function Room({
  roomCode = "L8K2QF",
  userRole = "GUEST",
  userName = "Guest",
  onLeave,
}) {
  const isHost = userRole === "HOST";

  const currentUserName = userName;
  const currentUserInitials = isHost ? "NK" : "ME";

  const stompClientRef = useRef(null);
  const clientIdRef = useRef(crypto.randomUUID());

  const peerConnectionsRef = useRef(new Map());
  const localAudioStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const [audioSharing, setAudioSharing] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [remoteAudioConnected, setRemoteAudioConnected] = useState(false);

  const joinedRef = useRef(false);

  const [connected, setConnected] = useState(false);

  const [messages, setMessages] = useState([]);

  const [people, setPeople] = useState([]);

  const [messageText, setMessageText] = useState("");

  const sendSignal = (event) => {
    const client = stompClientRef.current;

    if (!client || !client.connected) {
      return;
    }

    client.publish({
      destination: "/app/room",
      body: JSON.stringify({
        ...event,
        roomCode,
        sender: event.sender ?? currentUserName,
        role: userRole,
        clientId: clientIdRef.current,
      }),
    });
  };

  const closePeerConnection = (remoteClientId) => {
    const peer = peerConnectionsRef.current.get(remoteClientId);

    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;

      peer.close();

      peerConnectionsRef.current.delete(remoteClientId);
    }
  };

  const waitForIceGatheringComplete = (peer) => {
    if (peer.iceGatheringState === "complete") {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const handleGatheringStateChange = () => {
        if (peer.iceGatheringState === "complete") {
          peer.removeEventListener(
            "icegatheringstatechange",
            handleGatheringStateChange,
          );

          resolve();
        }
      };

      peer.addEventListener(
        "icegatheringstatechange",
        handleGatheringStateChange,
      );
    });
  };

  const createPeerConnection = async (remoteClientId, createOffer = false) => {
    if (!remoteClientId || remoteClientId === clientIdRef.current) {
      return null;
    }

    const existing = peerConnectionsRef.current.get(remoteClientId);

    if (existing) {
      return existing;
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
        {
          urls: "stun:stun1.l.google.com:19302",
        },
      ],
    });

    peerConnectionsRef.current.set(remoteClientId, peer);

    const localStream = localAudioStreamRef.current;

    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        peer.addTrack(track, localStream);
      });
    }

    peer.onicecandidate = () => {};

    peer.ontrack = (event) => {
      const [stream] = event.streams;

      if (stream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;

        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1;

        remoteAudioRef.current.play().catch((error) => {
          console.warn(
            "Browser blocked remote audio autoplay. Use Enable Host Audio:",
            error,
          );
        });

        setRemoteAudioConnected(true);
      }
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;

      if (
        state === "failed" ||
        state === "closed" ||
        state === "disconnected"
      ) {
        closePeerConnection(remoteClientId);
      }
    };

    if (createOffer) {
      const offer = await peer.createOffer();

      await peer.setLocalDescription(offer);

      await waitForIceGatheringComplete(peer);

      sendSignal({
        type: "WEBRTC_OFFER",
        targetClientId: remoteClientId,
        sdp: peer.localDescription?.sdp,
        sdpType: peer.localDescription?.type || "offer",
      });
    }

    return peer;
  };

  const startAudioSharing = () => {
    if (!isHost) {
      return;
    }

    setAudioError(
      "System audio is handled by the Melamour host app. Start host.py on the Windows host.",
    );
  };

  const enableRemoteAudio = async () => {
    const audio = remoteAudioRef.current;

    if (!audio) {
      setAudioError("Audio element is not ready yet.");
      return;
    }

    try {
      audio.muted = false;
      audio.volume = 1;

      // If the WebRTC stream has not arrived yet, restart the guest
      // connection and ask the Windows host app for the audio again.
      if (!audio.srcObject) {
        peerConnectionsRef.current.forEach((_, remoteClientId) => {
          closePeerConnection(remoteClientId);
        });

        sendSignal({
          type: "WEBRTC_REQUEST",
          sender: clientIdRef.current,
          role: userRole,
          clientId: clientIdRef.current,
        });

        // Give the host a few seconds to complete offer/answer and attach
        // the incoming MediaStream before attempting playback.
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));

          if (audio.srcObject) {
            break;
          }
        }
      }

      if (!audio.srcObject) {
        setAudioError(
          "Host audio stream is not connected yet. Start host.py and try again.",
        );
        return;
      }

      await audio.play();

      setRemoteAudioConnected(true);
      setAudioError("");
      console.log("Remote host audio playback enabled.");
    } catch (error) {
      console.error("Audio playback failed:", error);
      setAudioError("Tap Enable Host Audio again.");
    }
  };

  const stopAudioSharing = () => {
    const stream = localAudioStreamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());

      localAudioStreamRef.current = null;
    }

    peerConnectionsRef.current.forEach((peer) => {
      peer.getSenders().forEach((sender) => {
        if (sender.track) {
          peer.removeTrack(sender);
        }
      });
    });

    setAudioSharing(false);

    sendSignal({
      type: "AUDIO_STOPPED",
    });
  };

  const handleWebRTCOffer = async (event) => {
    if (event.targetClientId !== clientIdRef.current) {
      return;
    }

    const remoteClientId = event.sender || event.fromClientId;

    const offer = event.sdp
      ? {
          type: event.sdpType || "offer",
          sdp: event.sdp,
        }
      : event.offer;

    if (!remoteClientId || !offer) {
      return;
    }

    try {
      const peer = await createPeerConnection(remoteClientId, false);

      if (!peer) {
        return;
      }

      await peer.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peer.createAnswer();

      await peer.setLocalDescription(answer);

      await waitForIceGatheringComplete(peer);

      sendSignal({
        type: "WEBRTC_ANSWER",
        targetClientId: remoteClientId,
        sender: clientIdRef.current,
        sdp: peer.localDescription?.sdp,
        sdpType: peer.localDescription?.type || "answer",
      });

      console.log("WebRTC answer sent to host audio app.");
    } catch (error) {
      console.error("WebRTC offer error:", error);
    }
  };

  const handleWebRTCAnswer = async (event) => {
    if (event.targetClientId !== clientIdRef.current) {
      return;
    }

    const remoteClientId = event.sender || event.fromClientId;

    const answer = event.sdp
      ? {
          type: event.sdpType || "answer",
          sdp: event.sdp,
        }
      : event.answer;

    const peer = peerConnectionsRef.current.get(remoteClientId);

    if (!peer || !answer) {
      return;
    }

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(answer));

      console.log("WebRTC answer received from host audio app.");
    } catch (error) {
      console.error("WebRTC answer error:", error);
    }
  };

  const handleWebRTCIce = () => {};

  useEffect(() => {
    const client = new Client({
      brokerURL: WS_URL,

      reconnectDelay: 5000,

      debug: () => {},

      onConnect: () => {
        console.log("Melamour WebSocket connected");

        setConnected(true);

        setPeople((previous) => {
          const exists = previous.some(
            (person) => person.id == clientIdRef.current,
          );

          if (exists) {
            return previous;
          }

          return [
            ...previous,
            {
              id: clientIdRef.current,
              name: currentUserName,
              initials: currentUserInitials,
              role: userRole,
              avatar: isHost ? "host-avatar" : "avatar-two",
              status: "Listening",
            },
          ];
        });

        client.subscribe(`/topic/room/${roomCode}`, (message) => {
          try {
            const event = JSON.parse(message.body);

            console.log("Received room event:", event);

            handleIncomingEvent(event);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        });

        if (!joinedRef.current) {
          joinedRef.current = true;

          client.publish({
            destination: "/app/room",

            body: JSON.stringify({
              type: "JOIN_ROOM",
              roomCode: roomCode,
              sender: currentUserName,
              role: userRole,
              clientId: clientIdRef.current,
              message: "",
            }),
          });

          if (!isHost) {
            client.publish({
              destination: "/app/room",

              body: JSON.stringify({
                type: "WEBRTC_REQUEST",
                roomCode: roomCode,
                sender: clientIdRef.current,
                role: userRole,
                clientId: clientIdRef.current,
              }),
            });
          }
        }
      },

      onDisconnect: () => {
        console.log("Melamour WebSocket disconnected");

        setConnected(false);
      },

      onStompError: (frame) => {
        console.error("STOMP error:", frame.headers["message"]);

        setConnected(false);
      },

      onWebSocketError: (error) => {
        console.error("WebSocket error:", error);

        setConnected(false);
      },
    });

    stompClientRef.current = client;

    client.activate();

    return () => {
      if (client.connected) {
        client.publish({
          destination: "/app/room",

          body: JSON.stringify({
            type: "LEAVE_ROOM",
            roomCode: roomCode,
            sender: currentUserName,
            role: userRole,
            clientId: clientIdRef.current,
            message: "",
          }),
        });
      }

      joinedRef.current = false;

      peerConnectionsRef.current.forEach((peer) => peer.close());

      peerConnectionsRef.current.clear();

      if (localAudioStreamRef.current) {
        localAudioStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        localAudioStreamRef.current = null;
      }

      client.deactivate();

      stompClientRef.current = null;
    };
  }, [roomCode, userRole]);

  const handleIncomingEvent = (event) => {
    if (!event || !event.type) {
      return;
    }

    if (event.type === "USER_LIST") {
      const users = event.users || [];

      const formattedUsers = users.map((user) => {
        const isCurrentUser = user.clientId === clientIdRef.current;

        const isUserHost = user.role === "HOST";

        return {
          id: user.clientId,

          name: user.name || (isUserHost ? "Host" : "Guest"),

          initials: isCurrentUser
            ? currentUserInitials
            : isUserHost
              ? "NK"
              : "GU",

          role: user.role || "GUEST",

          avatar: isUserHost ? "host-avatar" : "avatar-two",

          status: "Listening",
        };
      });

      setPeople(formattedUsers);

      return;
    }

    if (event.type === "JOIN_ROOM") {
      const sender = event.sender || "Guest";

      const role = event.role || "GUEST";

      setPeople((previous) => {
        const exists = previous.some(
          (person) =>
            (event.clientId && person.id === event.clientId) ||
            person.name === sender,
        );

        if (exists) {
          return previous;
        }

        return [
          ...previous,
          {
            id: event.clientId || `${sender}-${Date.now()}`,

            name: sender,

            initials: role === "HOST" ? "NK" : "GU",

            role: role,

            avatar: role === "HOST" ? "host-avatar" : "avatar-two",

            status: "Listening",
          },
        ];
      });

      return;
    }

    if (event.type === "LEAVE_ROOM") {
      const sender = event.sender || "Guest";

      if (event.clientId) {
        closePeerConnection(event.clientId);
      }

      setPeople((previous) =>
        previous.filter(
          (person) => person.name !== sender && person.id !== event.clientId,
        ),
      );

      return;
    }

    if (event.type === "WEBRTC_OFFER") {
      handleWebRTCOffer(event);
      return;
    }

    if (event.type === "WEBRTC_ANSWER") {
      handleWebRTCAnswer(event);
      return;
    }

    if (event.type === "WEBRTC_ICE") {
      handleWebRTCIce(event);
      return;
    }

    if (event.type === "HOST_AUDIO_READY") {
      if (isHost) {
        setAudioSharing(true);
        setAudioError("");
      } else {
        sendSignal({
          type: "WEBRTC_REQUEST",
          sender: clientIdRef.current,
        });
      }

      console.log("Melamour host audio app is ready.");

      return;
    }

    if (event.type === "AUDIO_STOPPED") {
      if (isHost) {
        setAudioSharing(false);
      } else {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.pause();
          remoteAudioRef.current.srcObject = null;
        }

        setRemoteAudioConnected(false);
      }

      return;
    }

    if (event.type === "CHAT_MESSAGE") {
      const sender = event.sender || "Guest";

      const role = event.role || "GUEST";

      setMessages((previous) => [
        ...previous,
        {
          id: `${Date.now()}-${Math.random()}`,

          sender: sender,

          message: event.message || "",

          initials:
            role === "HOST"
              ? "NK"
              : sender === currentUserName
                ? currentUserInitials
                : "GU",

          avatar: role === "HOST" ? "host-avatar" : "avatar-two",

          own: sender === currentUserName,
        },
      ]);

      return;
    }

    if (event.type === "REACTION") {
      console.log(`${event.sender || "Guest"} reacted:`, event.message);

      return;
    }
  };

  const sendMessage = () => {
    const message = messageText.trim();

    if (!message) {
      return;
    }

    const client = stompClientRef.current;

    if (!client || !client.connected) {
      console.warn("WebSocket is not connected");

      return;
    }

    client.publish({
      destination: "/app/room",

      body: JSON.stringify({
        type: "CHAT_MESSAGE",
        roomCode: roomCode,
        sender: currentUserName,
        role: userRole,
        message: message,
      }),
    });

    setMessageText("");
  };

  const sendReaction = (reaction) => {
    const client = stompClientRef.current;

    if (!client || !client.connected) {
      return;
    }

    client.publish({
      destination: "/app/room",

      body: JSON.stringify({
        type: "REACTION",
        roomCode: roomCode,
        sender: currentUserName,
        role: userRole,
        message: reaction,
      }),
    });
  };

  const handleChatKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      sendMessage();
    }
  };

  const handleLeave = () => {
    const client = stompClientRef.current;

    if (client?.connected) {
      client.publish({
        destination: "/app/room",

        body: JSON.stringify({
          type: "LEAVE_ROOM",
          roomCode: roomCode,
          sender: currentUserName,
          role: userRole,
          clientId: clientIdRef.current,
          message: "",
        }),
      });
    }

    onLeave();
  };

  return (
    <div className="room-page">
      <header className="room-header">
        <div className="room-brand">
          <button className="room-back" onClick={handleLeave}>
            <ArrowLeft size={18} />
          </button>

          <div className="room-brand-icon">
            <Headphones size={18} />
          </div>

          <span>Melamour</span>
        </div>

        <div className="room-header-right">
          <div
            className="room-role-pill"
            style={{
              background: isHost
                ? "rgba(216, 180, 118, 0.08)"
                : "rgba(255, 255, 255, 0.04)",

              border: isHost
                ? "1px solid rgba(216, 180, 118, 0.18)"
                : "1px solid rgba(255, 255, 255, 0.07)",

              color: isHost ? "#d8b476" : "#aaa",

              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            {isHost ? <Crown size={13} /> : <Headphones size={13} />}

            {isHost ? "HOST" : "GUEST"}
          </div>

          <div className="room-code-pill">
            <span>Room</span>

            <strong>{roomCode}</strong>

            <button
              onClick={() => navigator.clipboard?.writeText(roomCode)}
              title="Copy room code"
            >
              <Copy size={14} />
            </button>
          </div>

          <button className="room-more">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      <main className="room-main">
        <section className="now-playing">
          <div className="now-playing-label">
            <span className="music-dot" />
            NOW PLAYING
          </div>

          <div className="album-large">
            <div className="album-ring">
              <div className="album-center">
                <Headphones size={32} />
              </div>
            </div>
          </div>

          <div className="song-details">
            <h1>The Night We Met</h1>

            <p>Lord Huron</p>
          </div>

          <div className="song-actions">
            <button onClick={() => sendReaction("❤️")} title="Love">
              <Heart size={19} />
            </button>

            <button>
              <MoreHorizontal size={19} />
            </button>
          </div>

          <div className="progress-area">
            <div className="progress-bar">
              <div className="progress-value" />
            </div>

            <div className="time-row">
              <span>2:14</span>

              <span>5:21</span>
            </div>
          </div>

          {isHost ? (
            <div className="main-controls">
              <button
                className="control-small"
                title="Host audio app status"
                onClick={startAudioSharing}
              >
                <Volume2 size={18} />
              </button>

              <button
                className="control-play"
                title="Windows host audio app"
                onClick={startAudioSharing}
              >
                {audioSharing ? (
                  <Pause size={21} fill="currentColor" />
                ) : (
                  <Play size={20} fill="currentColor" />
                )}
              </button>

              <div className="host-label">
                <span className="host-dot" />

                {audioSharing ? "HOST AUDIO LIVE" : "START HOST AUDIO APP"}
              </div>
            </div>
          ) : (
            <div className="main-controls">
              <button
                className="control-small"
                disabled
                style={{
                  opacity: 0.45,
                  cursor: "default",
                }}
              >
                <Volume2 size={18} />
              </button>

              <button
                className="control-play"
                disabled
                style={{
                  opacity: remoteAudioConnected ? 1 : 0.45,

                  cursor: "default",
                }}
              >
                {remoteAudioConnected ? (
                  <Volume2 size={20} />
                ) : (
                  <Play size={20} fill="currentColor" />
                )}
              </button>

              <div
                className="host-label"
                style={{
                  color: remoteAudioConnected ? "#d8b476" : "#8d8790",
                }}
              >
                <span
                  className="host-dot"
                  style={{
                    background: remoteAudioConnected ? "#72c28b" : "#777",
                  }}
                />

                {remoteAudioConnected
                  ? "LISTENING TO HOST"
                  : "WAITING FOR HOST AUDIO"}
              </div>
            </div>
          )}

          {audioError && (
            <div
              style={{
                marginTop: "12px",

                color: "#d9a7b8",

                fontSize: "12px",

                textAlign: "center",
              }}
            >
              {audioError}
            </div>
          )}

          {!isHost && (
            <button
              onClick={enableRemoteAudio}
              style={{
                padding: "12px 20px",
                borderRadius: "12px",
                border: "none",
                background: "#e8a0b8",
                color: "#171717",
                fontWeight: 700,
                cursor: "pointer",
                marginTop: "14px",
                marginBottom: "4px",
              }}
            >
              🔊 Enable Host Audio
            </button>
          )}

          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
            controls={false}
            muted={false}
            style={{
              display: "none",
            }}
          />
        </section>

        <section className="room-bottom">
          <div className="room-panel people-panel">
            <div className="panel-header">
              <div>
                <h2>People in room</h2>

                <p>
                  {people.length} {people.length === 1 ? "person" : "people"}{" "}
                  listening
                </p>
              </div>

              <Users size={18} />
            </div>

            <div className="people-list">
              {people.length === 0 ? (
                <div
                  style={{
                    padding: "24px 0",

                    textAlign: "center",

                    color: "#777",

                    fontSize: "13px",
                  }}
                >
                  Connecting to room...
                </div>
              ) : (
                people.map((person) => (
                  <div className="person" key={person.id}>
                    <div className={`person-avatar ${person.avatar}`}>
                      {person.initials}
                    </div>

                    <div className="person-info">
                      <strong>
                        {person.name}

                        {person.id === clientIdRef.current && " · You"}
                      </strong>

                      <span>{person.role === "HOST" ? "Host" : "Guest"}</span>
                    </div>

                    <div className="person-playing">
                      <span />

                      {person.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="room-panel chat-panel">
            <div className="panel-header">
              <div>
                <h2>Live chat</h2>

                <p>Talk while you listen</p>
              </div>

              <MessageCircle size={18} />
            </div>

            <div className="chat-messages">
              {messages.length === 0 ? (
                <div
                  style={{
                    display: "flex",

                    alignItems: "center",

                    justifyContent: "center",

                    height: "100%",

                    minHeight: "120px",

                    color: "#777",

                    fontSize: "13px",

                    textAlign: "center",
                  }}
                >
                  No messages yet.
                  <br />
                  Start the conversation.
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    className={`chat-message ${
                      message.own ? "own-message" : ""
                    }`}
                    key={message.id}
                  >
                    <div className={`chat-avatar ${message.avatar}`}>
                      {message.initials}
                    </div>

                    <div>
                      <strong>{message.own ? "You" : message.sender}</strong>

                      <p>{message.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="chat-input">
              <input
                type="text"
                placeholder={connected ? "Type a message..." : "Connecting..."}
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                onKeyDown={handleChatKeyDown}
                disabled={!connected}
              />

              <button
                onClick={sendMessage}
                disabled={!connected || !messageText.trim()}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="room-footer">
        <div>
          <span className="secure-dot" />
          Private room
        </div>

        <div
          style={{
            display: "flex",

            alignItems: "center",

            gap: "7px",

            fontSize: "12px",

            color: "#777",
          }}
        >
          <LockKeyhole size={13} />

          {isHost
            ? "You are hosting this room"
            : "You are listening as a guest"}
        </div>

        <button onClick={handleLeave}>Leave room</button>
      </footer>
    </div>
  );
}

export default Room;
