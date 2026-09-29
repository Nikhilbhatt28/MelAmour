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
  Crown,
  Upload,
  Music2,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Client } from "@stomp/stompjs";
import "./Room.css";

const API_BASE = "https://melamour-backend.onrender.com/api";
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
  const clientIdRef = useRef(crypto.randomUUID());
  const stompClientRef = useRef(null);
  const audioRef = useRef(null);
  const fileRef = useRef(null);
  const joinedRef = useRef(false);

  const [connected, setConnected] = useState(false);
  const [people, setPeople] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [audioError, setAudioError] = useState("");

  const sendSignal = (event) => {
    const client = stompClientRef.current;
    if (!client?.connected) return;
    client.publish({
      destination: "/app/room",
      body: JSON.stringify({
        ...event,
        roomCode,
        sender: currentUserName,
        role: userRole,
        clientId: clientIdRef.current,
      }),
    });
  };

  const loadSongs = async () => {
    try {
      const response = await fetch(`${API_BASE}/songs`);
      if (!response.ok) throw new Error("Library unavailable");
      setSongs(await response.json());
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadSongs();
  }, []);

  const playSong = async (song, broadcast = true, startAt = 0) => {
    setCurrentSong(song);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = `${API_BASE}/songs/${song.id}/stream`;
    audio.currentTime = startAt || 0;
    try {
      await audio.play();
      setIsPlaying(true);
      setAudioError("");
    } catch (error) {
      setIsPlaying(false);
      setAudioError("Tap Play to start the song.");
      console.warn(error);
    }
    if (broadcast)
      sendSignal({
        type: "PLAY_SONG",
        songId: song.id,
        position: startAt || 0,
      });
  };

  const togglePlay = async () => {
    if (!currentSong) {
      if (isHost && songs[0]) await playSong(songs[0]);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
      sendSignal({
        type: "RESUME_SONG",
        songId: currentSong.id,
        position: audio.currentTime,
      });
    } else {
      audio.pause();
      setIsPlaying(false);
      sendSignal({
        type: "PAUSE_SONG",
        songId: currentSong.id,
        position: audio.currentTime,
      });
    }
  };

  const seek = (value) => {
    const time = Number(value);
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
    if (isHost && currentSong)
      sendSignal({ type: "SEEK_SONG", songId: currentSong.id, position: time });
  };

  const uploadSong = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setAudioError("");
    const form = new FormData();
    form.append("file", file);
    form.append("title", file.name.replace(/\.[^.]+$/, ""));
    form.append("artist", currentUserName);
    try {
      const response = await fetch(`${API_BASE}/songs/upload`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error(await response.text());
      const song = await response.json();
      await loadSongs();
      if (isHost) await playSong(song);
    } catch (error) {
      console.error(error);
      setAudioError("Upload failed. Use MP3, WAV, OGG or M4A (max 50 MB).");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      debug: () => {},
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/room/${roomCode}`, (message) => {
          try {
            handleIncomingEvent(JSON.parse(message.body));
          } catch (e) {
            console.error(e);
          }
        });
        if (!joinedRef.current) {
          joinedRef.current = true;
          sendWithClient(client, {
            type: "JOIN_ROOM",
            roomCode,
            sender: currentUserName,
            role: userRole,
            clientId: clientIdRef.current,
            message: "",
          });
        }
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
      onWebSocketError: () => setConnected(false),
    });
    stompClientRef.current = client;
    client.activate();
    return () => {
      joinedRef.current = false;
      if (client.connected)
        sendWithClient(client, {
          type: "LEAVE_ROOM",
          roomCode,
          sender: currentUserName,
          role: userRole,
          clientId: clientIdRef.current,
          message: "",
        });
      client.deactivate();
    };
  }, [roomCode, userRole]);

  function sendWithClient(client, event) {
    client.publish({ destination: "/app/room", body: JSON.stringify(event) });
  }

  const handleIncomingEvent = async (event) => {
    if (!event?.type) return;
    if (event.type === "USER_LIST") {
      setPeople(
        (event.users || []).map((u) => ({
          id: u.clientId,
          name: u.name || "Guest",
          initials: u.role === "HOST" ? "NK" : "GU",
          role: u.role || "GUEST",
          avatar: u.role === "HOST" ? "host-avatar" : "avatar-two",
          status: "Listening",
        })),
      );
      return;
    }
    if (event.type === "JOIN_ROOM") {
      setPeople((prev) =>
        prev.some((p) => p.id === event.clientId)
          ? prev
          : [
              ...prev,
              {
                id: event.clientId,
                name: event.sender || "Guest",
                initials: event.role === "HOST" ? "NK" : "GU",
                role: event.role || "GUEST",
                avatar: event.role === "HOST" ? "host-avatar" : "avatar-two",
                status: "Listening",
              },
            ],
      );
      return;
    }
    if (event.type === "LEAVE_ROOM") {
      setPeople((prev) => prev.filter((p) => p.id !== event.clientId));
      return;
    }
    if (event.type === "PLAY_SONG") {
      const song =
        songs.find((s) => Number(s.id) === Number(event.songId)) ||
        (await fetchSong(event.songId));
      if (song) await playSong(song, false, Number(event.position) || 0);
      return;
    }
    if (event.type === "PAUSE_SONG" && audioRef.current) {
      audioRef.current.currentTime = Number(event.position) || 0;
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    if (event.type === "RESUME_SONG" && audioRef.current) {
      audioRef.current.currentTime = Number(event.position) || 0;
      await audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      return;
    }
    if (event.type === "SEEK_SONG" && audioRef.current) {
      audioRef.current.currentTime = Number(event.position) || 0;
      return;
    }
    if (event.type === "CHAT_MESSAGE") {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          sender: event.sender || "Guest",
          message: event.message || "",
          initials: event.role === "HOST" ? "NK" : "GU",
          avatar: event.role === "HOST" ? "host-avatar" : "avatar-two",
          own: event.sender === currentUserName,
        },
      ]);
    }
  };

  const fetchSong = async (id) => {
    try {
      const r = await fetch(`${API_BASE}/songs`);
      const list = await r.json();
      setSongs(list);
      return list.find((s) => Number(s.id) === Number(id));
    } catch {
      return null;
    }
  };

  const sendMessage = () => {
    const message = messageText.trim();
    if (!message) return;
    sendSignal({ type: "CHAT_MESSAGE", message });
    setMessageText("");
  };
  const handleLeave = () => {
    sendSignal({ type: "LEAVE_ROOM" });
    onLeave();
  };
  const formatTime = (seconds) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

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
            style={{ color: isHost ? "#d8b476" : "#aaa" }}
          >
            {isHost ? <Crown size={13} /> : <Headphones size={13} />}
            {isHost ? "HOST" : "GUEST"}
          </div>
          <div className="room-code-pill">
            <span>Room</span>
            <strong>{roomCode}</strong>
            <button onClick={() => navigator.clipboard?.writeText(roomCode)}>
              <Copy size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="room-main">
        <section className="now-playing">
          <div className="now-playing-label">
            <span className="music-dot" /> NOW PLAYING
          </div>
          <div className="album-large">
            <div className="album-ring">
              <div className="album-center">
                <Music2 size={32} />
              </div>
            </div>
          </div>
          <div className="song-details">
            <h1>{currentSong?.title || "Nothing playing"}</h1>
            <p>{currentSong?.artist || "Choose a song from the library"}</p>
          </div>
          <div className="progress-area">
            <input
              className="song-range"
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => seek(e.target.value)}
              disabled={!currentSong}
            />
            <div className="time-row">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <div className="main-controls">
            <button
              className="control-small"
              onClick={() => currentSong && seek(Math.max(0, currentTime - 10))}
            >
              <SkipBack size={18} />
            </button>
            <button className="control-play" onClick={togglePlay}>
              {isPlaying ? (
                <Pause size={21} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
            </button>
            <button
              className="control-small"
              onClick={() =>
                currentSong && seek(Math.min(duration, currentTime + 10))
              }
            >
              <SkipForward size={18} />
            </button>
          </div>
          {audioError && <div className="audio-error">{audioError}</div>}
          <audio
            ref={audioRef}
            onTimeUpdate={() =>
              setCurrentTime(audioRef.current?.currentTime || 0)
            }
            onLoadedMetadata={() =>
              setDuration(audioRef.current?.duration || 0)
            }
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
          />
        </section>

        <section className="room-panels">
          <div className="room-panel library-panel">
            <div className="panel-header">
              <div>
                <h2>Music library</h2>
                <p>
                  {isHost ? "Choose what everyone hears" : "Live room playlist"}
                </p>
              </div>
              {isHost && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a"
                    hidden
                    onChange={uploadSong}
                  />
                  <button
                    className="upload-song-btn"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload size={15} />
                    {uploading ? "Uploading..." : "Upload song"}
                  </button>
                </>
              )}
            </div>
            <div className="song-library">
              {songs.length === 0 ? (
                <div className="empty-library">
                  No songs yet.{" "}
                  {isHost
                    ? "Upload an MP3 to start the room."
                    : "Ask the host to add a song."}
                </div>
              ) : (
                songs.map((song) => (
                  <button
                    key={song.id}
                    className={`library-song ${currentSong?.id === song.id ? "active" : ""}`}
                    onClick={() => isHost && playSong(song)}
                    disabled={!isHost}
                  >
                    <div className="library-icon">
                      <Music2 size={16} />
                    </div>
                    <div>
                      <strong>{song.title}</strong>
                      <span>{song.artist || "Melamour"}</span>
                    </div>
                    <Play size={15} />
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="room-panel people-panel">
            <div className="panel-header">
              <div>
                <h2>In this room</h2>
                <p>Everyone listening together</p>
              </div>
              <Users size={18} />
            </div>
            <div className="people-list">
              {people.length === 0 ? (
                <div className="empty-library">Connecting...</div>
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
                      Listening
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
                <div className="empty-library">
                  No messages yet.
                  <br />
                  Start the conversation.
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    className={`chat-message ${m.own ? "own-message" : ""}`}
                    key={m.id}
                  >
                    <div className={`chat-avatar ${m.avatar}`}>
                      {m.initials}
                    </div>
                    <div>
                      <strong>{m.own ? "You" : m.sender}</strong>
                      <p>{m.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="chat-input">
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={connected ? "Type a message..." : "Connecting..."}
              />
              <button onClick={sendMessage}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Room;
