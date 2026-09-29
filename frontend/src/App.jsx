import { useState } from "react";

import {
  ArrowRight,
  Headphones,
  Heart,
  MessageCircle,
  Music2,
  Play,
  Users,
  X,
  LockKeyhole,
  Copy,
  Check,
  LogIn,
} from "lucide-react";

import "./App.css";
import Room from "./Room";

const API_BASE_URL = "https://melamour-backend.onrender.com/api";

const features = [
  {
    icon: Users,
    title: "Private Rooms",
    text: "Only people with your room code can join.",
  },
  {
    icon: Music2,
    title: "Real-Time Listening",
    text: "Share your music and hear it together, in sync.",
  },
  {
    icon: MessageCircle,
    title: "Chat & React",
    text: "Talk, react, and vibe while the music plays.",
  },
  {
    icon: Heart,
    title: "For Your People",
    text: "Same songs. Different places. Still together.",
  },
];

function App() {
  const [currentPage, setCurrentPage] = useState("home");

  // =========================================================
  // CREATE ROOM
  // =========================================================

  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomCreated, setRoomCreated] = useState(false);

  const [roomName, setRoomName] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  // =========================================================
  // JOIN ROOM
  // =========================================================

  const [showJoinRoom, setShowJoinRoom] = useState(false);

  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinName, setJoinName] = useState("");

  // =========================================================
  // SHARED ROOM STATE
  // =========================================================

  const [roomCode, setRoomCode] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");

  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);

  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");

  // =========================================================
  // CREATE ROOM
  // =========================================================

  const createRoom = async () => {
    setCreateError("");

    const name = joinName.trim();
    const nameForRoom = roomName.trim();
    const password = createPassword.trim();

    if (!name) {
      setCreateError("Please enter your name.");
      return;
    }

    if (!nameForRoom) {
      setCreateError("Please enter a room name.");
      return;
    }

    try {
      setCreatingRoom(true);

      const response = await fetch(`${API_BASE_URL}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomName: nameForRoom,
          password,
          hostName: name,
        }),
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data?.message || "Unable to create the room.");
      }

      if (!data.roomCode) {
        throw new Error("Room was created, but no room code was returned.");
      }

      setRoomCode(data.roomCode);
      setUserRole(data.role || "HOST");
      setUserName(name);

      setRoomCreated(true);
    } catch (error) {
      console.error("Create room error:", error);

      setCreateError(
        error?.message || "Unable to connect to the Melamour backend.",
      );
    } finally {
      setCreatingRoom(false);
    }
  };

  // =========================================================
  // JOIN ROOM
  // =========================================================

  const joinRoom = async () => {
    setJoinError("");

    const name = joinName.trim();
    const code = joinRoomCode.trim().toUpperCase();
    const password = joinPassword;

    if (!name) {
      setJoinError("Please enter your name.");
      return;
    }

    if (!code) {
      setJoinError("Please enter a room code.");
      return;
    }

    if (code.length !== 6) {
      setJoinError("Room code must contain 6 characters.");
      return;
    }

    try {
      setJoiningRoom(true);

      const response = await fetch(`${API_BASE_URL}/rooms/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomCode: code,
          password,
          memberName: name,
        }),
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data?.message || "Unable to join the room.");
      }

      if (!data.roomCode) {
        throw new Error("Room was joined, but no room code was returned.");
      }

      setRoomCode(data.roomCode);
      setUserRole(data.role || "GUEST");
      setUserName(name);

      setShowJoinRoom(false);

      setJoinRoomCode("");
      setJoinPassword("");
      setJoinName("");
      setJoinError("");

      setCurrentPage("room");
    } catch (error) {
      console.error("Join room error:", error);

      let message =
        error?.message || "Unable to connect to the Melamour backend.";

      if (message === "Room not found") {
        message = "Room not found. Check the room code.";
      }

      if (message === "Incorrect room password") {
        message = "Incorrect room password.";
      }

      if (message === "Room is locked") {
        message = "This room is currently locked.";
      }

      if (message === "Room is no longer active") {
        message = "This room is no longer active.";
      }

      setJoinError(message);
    } finally {
      setJoiningRoom(false);
    }
  };

  // =========================================================
  // CLOSE CREATE MODAL
  // =========================================================

  const closeCreateModal = () => {
    if (creatingRoom) {
      return;
    }

    setShowCreateRoom(false);

    setTimeout(() => {
      setRoomCreated(false);
      setRoomCode("");
      setRoomName("");
      setCreatePassword("");
      setJoinName("");
      setCreateError("");
    }, 250);
  };

  // =========================================================
  // CLOSE JOIN MODAL
  // =========================================================

  const closeJoinModal = () => {
    if (joiningRoom) {
      return;
    }

    setShowJoinRoom(false);

    setTimeout(() => {
      setJoinRoomCode("");
      setJoinPassword("");
      setJoinName("");
      setJoinError("");
    }, 250);
  };

  // =========================================================
  // ENTER CREATED ROOM
  // =========================================================

  const enterCreatedRoom = () => {
    setShowCreateRoom(false);
    setCurrentPage("room");
  };

  // =========================================================
  // LEAVE ROOM
  // =========================================================

  const leaveRoom = () => {
    setCurrentPage("home");

    setRoomCode("");
    setUserRole("");
    setUserName("");
    setRoomCreated(false);
  };

  // =========================================================
  // ROOM PAGE
  // =========================================================

  if (currentPage === "room") {
    return (
      <Room
        roomCode={roomCode}
        userRole={userRole}
        userName={userName}
        onLeave={leaveRoom}
      />
    );
  }

  // =========================================================
  // HOME PAGE
  // =========================================================

  return (
    <div className="site">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {/* =====================================================
          NAVBAR
          ===================================================== */}

      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">
            <Music2 size={19} />
          </div>

          <span>Melamour</span>
        </div>

        <nav>
          <a className="active" href="#home">
            Home
          </a>

          <a href="#features">Features</a>

          <a href="#how">How it works</a>

          <a href="#about">About</a>
        </nav>

        <button
          className="nav-cta"
          onClick={() => {
            setCreateError("");
            setShowCreateRoom(true);
          }}
        >
          Get Started
          <ArrowRight size={16} />
        </button>
      </header>

      {/* =====================================================
          HERO
          ===================================================== */}

      <main id="home">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <Headphones size={14} />

              <span>Private · Real-time · Together</span>
            </div>

            <h1>
              A little room
              <br />
              for <span>your people.</span>
            </h1>

            <p>
              Create a private room, share what you're listening to, and feel
              closer — through music.
            </p>

            <div className="hero-actions">
              <button
                className="primary-btn"
                onClick={() => {
                  setCreateError("");
                  setShowCreateRoom(true);
                }}
              >
                <Users size={18} />
                Create a Room
                <ArrowRight size={17} />
              </button>

              <button
                className="secondary-btn"
                onClick={() => {
                  setJoinError("");
                  setShowJoinRoom(true);
                }}
              >
                <LogIn size={17} />
                Join a Room
              </button>
            </div>

            <div className="social-proof">
              <div className="avatars">
                <span>AK</span>
                <span>NK</span>
                <span>RS</span>
                <span>+</span>
              </div>

              <div className="proof-line" />

              <p>Music sounds better together.</p>
            </div>
          </div>

          {/* =================================================
              MUSIC VISUAL
              ================================================= */}

          <div className="visual">
            <div className="visual-glow" />

            <div className="room-scene">
              <div className="window">
                <div className="moon" />

                <div className="city city-one" />

                <div className="city city-two" />

                <div className="city city-three" />
              </div>

              <div className="record-player">
                <div className="record">
                  <div className="record-center" />
                </div>

                <div className="player-arm" />
              </div>

              <div className="speaker speaker-left" />

              <div className="speaker speaker-right" />

              <div className="lamp" />

              <div className="headphones">
                <div className="headphone-band" />

                <div className="ear left" />

                <div className="ear right" />
              </div>
            </div>

            {/* PLAYER */}

            <div className="player-card">
              <div className="album-art">
                <Music2 size={26} />
              </div>

              <div className="track-info">
                <strong>The Night We Met</strong>

                <span>Lord Huron</span>
              </div>

              <Heart className="heart" size={18} fill="currentColor" />

              <div className="wave">
                {Array.from({ length: 28 }).map((_, index) => (
                  <i
                    key={index}
                    style={{
                      height: `${8 + ((index * 13) % 25)}px`,
                    }}
                  />
                ))}
              </div>

              <div className="player-controls">
                <span>2:14</span>

                <button>
                  <Play size={13} fill="currentColor" />
                </button>

                <span>5:21</span>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            FEATURES
            ================================================= */}

        <section
          className="features"
          id="features"
          style={{
            width: "min(1180px, calc(100% - 64px))",
            margin: "90px auto 120px",
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "16px",
          }}
        >
          {features.map(({ icon: Icon, title, text }) => (
            <article
              className="feature-card"
              key={title}
              style={{
                width: "100%",
                minWidth: 0,
                minHeight: "225px",
              }}
            >
              <div className="feature-icon">
                <Icon size={20} />
              </div>

              <h3>{title}</h3>

              <p>{text}</p>
            </article>
          ))}
        </section>
      </main>

      {/* =====================================================
          CREATE ROOM MODAL
          ===================================================== */}

      {showCreateRoom && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateModal();
            }
          }}
        >
          <div className="room-modal">
            <button
              className="close-modal"
              onClick={closeCreateModal}
              disabled={creatingRoom}
            >
              <X size={18} />
            </button>

            {!roomCreated ? (
              <>
                <div className="modal-icon">
                  <Users size={23} />
                </div>

                <h2>Create a room</h2>

                <p className="modal-description">
                  Set up your private listening space and invite your people.
                </p>

                {/* YOUR NAME */}

                <div className="input-group">
                  <label>Your name</label>

                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={joinName}
                    maxLength={30}
                    autoComplete="name"
                    onChange={(event) => {
                      setJoinName(event.target.value);
                      setCreateError("");
                    }}
                  />
                </div>

                {/* ROOM NAME */}

                <div className="input-group">
                  <label>Room name</label>

                  <input
                    type="text"
                    placeholder="Late Night"
                    value={roomName}
                    maxLength={100}
                    onChange={(event) => {
                      setRoomName(event.target.value);
                      setCreateError("");
                    }}
                  />
                </div>

                {/* PASSWORD */}

                <div className="input-group">
                  <label>Password</label>

                  <div className="input-with-icon">
                    <LockKeyhole size={16} />

                    <input
                      type="password"
                      placeholder="Optional"
                      value={createPassword}
                      maxLength={100}
                      autoComplete="new-password"
                      onChange={(event) => {
                        setCreatePassword(event.target.value);
                        setCreateError("");
                      }}
                    />
                  </div>
                </div>

                {createError && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: "rgba(190, 80, 100, 0.10)",
                      border: "1px solid rgba(190, 80, 100, 0.22)",
                      color: "#d9a7b8",
                      fontSize: "12px",
                      lineHeight: "1.4",
                    }}
                  >
                    {createError}
                  </div>
                )}

                <button
                  className="create-modal-btn"
                  onClick={createRoom}
                  disabled={creatingRoom}
                  style={{
                    opacity: creatingRoom ? 0.7 : 1,
                    cursor: creatingRoom ? "wait" : "pointer",
                  }}
                >
                  {creatingRoom ? "Creating..." : "Create Room"}

                  {!creatingRoom && <ArrowRight size={17} />}
                </button>

                <div className="modal-security">
                  <LockKeyhole size={13} />
                  Your room stays private.
                </div>
              </>
            ) : (
              <>
                <div className="success-icon">
                  <Check size={24} />
                </div>

                <h2>Your room is ready</h2>

                <p className="modal-description">
                  Share this code with the people you want to listen with.
                </p>

                <div className="room-code-label">ROOM CODE</div>

                <div className="room-code">
                  <span>{roomCode}</span>

                  <button
                    onClick={() => navigator.clipboard?.writeText(roomCode)}
                    title="Copy room code"
                  >
                    <Copy size={17} />
                  </button>
                </div>

                <button className="create-modal-btn" onClick={enterCreatedRoom}>
                  Enter Room
                  <ArrowRight size={17} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          JOIN ROOM MODAL
          ===================================================== */}

      {showJoinRoom && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeJoinModal();
            }
          }}
        >
          <div className="room-modal">
            <button
              className="close-modal"
              onClick={closeJoinModal}
              disabled={joiningRoom}
            >
              <X size={18} />
            </button>

            <div className="modal-icon">
              <LogIn size={23} />
            </div>

            <h2>Join a room</h2>

            <p className="modal-description">
              Enter the room code shared by your host.
            </p>

            {/* ROOM CODE */}

            <div className="input-group">
              <label>Room code</label>

              <input
                type="text"
                placeholder="ABC123"
                maxLength={6}
                value={joinRoomCode}
                autoCapitalize="characters"
                onChange={(event) => {
                  setJoinRoomCode(
                    event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                  );

                  setJoinError("");
                }}
                style={{
                  letterSpacing: "2px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              />
            </div>

            {/* YOUR NAME */}

            <div className="input-group">
              <label>Your name</label>

              <input
                type="text"
                placeholder="Enter your name"
                value={joinName}
                maxLength={40}
                autoComplete="name"
                onChange={(event) => {
                  setJoinName(event.target.value);
                  setJoinError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !joiningRoom) {
                    joinRoom();
                  }
                }}
              />
            </div>

            {/* PASSWORD */}

            <div className="input-group">
              <label>Password</label>

              <div className="input-with-icon">
                <LockKeyhole size={16} />

                <input
                  type="password"
                  placeholder="If the room has one"
                  value={joinPassword}
                  maxLength={100}
                  autoComplete="current-password"
                  onChange={(event) => {
                    setJoinPassword(event.target.value);
                    setJoinError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !joiningRoom) {
                      joinRoom();
                    }
                  }}
                />
              </div>
            </div>

            {joinError && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  background: "rgba(190, 80, 100, 0.10)",
                  border: "1px solid rgba(190, 80, 100, 0.22)",
                  color: "#d9a7b8",
                  fontSize: "12px",
                  lineHeight: "1.4",
                }}
              >
                {joinError}
              </div>
            )}

            <button
              className="create-modal-btn"
              onClick={joinRoom}
              disabled={joiningRoom}
              style={{
                opacity: joiningRoom ? 0.7 : 1,
                cursor: joiningRoom ? "wait" : "pointer",
              }}
            >
              {joiningRoom ? "Joining..." : "Join Room"}

              {!joiningRoom && <ArrowRight size={17} />}
            </button>

            <div className="modal-security">
              <LockKeyhole size={13} />
              Only people with the room code can enter.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
