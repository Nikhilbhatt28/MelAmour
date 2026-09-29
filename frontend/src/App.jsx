import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
  // BACKGROUND MUSIC
  // =========================================================

  const bgMusicRef = useRef(null);
  const [bgMusicOn, setBgMusicOn] = useState(() => {
    return localStorage.getItem("melamour-bg-music") !== "off";
  });

  useEffect(() => {
    if (currentPage !== "home") {
      bgMusicRef.current?.pause();
      return;
    }

    const audio = new Audio("/music/melamour-ambient.mp3");
    audio.loop = true;
    audio.volume = 0.22;
    bgMusicRef.current = audio;

    const startMusic = async () => {
      if (!bgMusicOn) return;

      try {
        await audio.play();
      } catch {
        // Browser autoplay policy may block unmuted playback.
        // First user interaction will retry it.
      }
    };

    startMusic();

    const retryAfterInteraction = () => {
      if (!bgMusicOn) return;

      audio.play().catch(() => {});
      window.removeEventListener("pointerdown", retryAfterInteraction);
      window.removeEventListener("keydown", retryAfterInteraction);
    };

    window.addEventListener("pointerdown", retryAfterInteraction, {
      once: true,
    });
    window.addEventListener("keydown", retryAfterInteraction, { once: true });

    return () => {
      audio.pause();
      audio.currentTime = 0;
      window.removeEventListener("pointerdown", retryAfterInteraction);
      window.removeEventListener("keydown", retryAfterInteraction);
      bgMusicRef.current = null;
    };
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem("melamour-bg-music", bgMusicOn ? "on" : "off");

    if (!bgMusicRef.current) return;

    if (bgMusicOn) {
      bgMusicRef.current.play().catch(() => {});
    } else {
      bgMusicRef.current.pause();
    }
  }, [bgMusicOn]);

  const toggleBackgroundMusic = () => {
    setBgMusicOn((previous) => !previous);
  };

  // Always start Home/Room at the very top.
  // useLayoutEffect runs before the browser paints the new page.
  useLayoutEffect(() => {
    const resetScroll = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    resetScroll();

    const frame = window.requestAnimationFrame(resetScroll);
    const timer = window.setTimeout(resetScroll, 80);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [currentPage]);

  // Stop Chrome/Edge from restoring the previous scroll position.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const forceTop = () => {
      if (currentPage === "home") {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener("pageshow", forceTop);

    return () => {
      window.removeEventListener("pageshow", forceTop);

      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "auto";
      }
    };
  }, [currentPage]);

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
          type="button"
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
                type="button"
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
                type="button"
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

            <div className="player-card ambient-player">
              <div className="album-art ambient-art">
                <Music2 size={25} />
              </div>

              <div className="track-info">
                <strong>Ambient Room Sound</strong>
                <span>MelAmour</span>
              </div>

              <div className="wave" aria-hidden="true">
                {Array.from({ length: 28 }).map((_, index) => (
                  <i
                    key={index}
                    style={{
                      height: `${8 + ((index * 13) % 25)}px`,
                      opacity: bgMusicOn ? 1 : 0.25,
                    }}
                  />
                ))}
              </div>

              <button
                className={`ambient-toggle ${bgMusicOn ? "is-on" : ""}`}
                onClick={toggleBackgroundMusic}
                aria-label={
                  bgMusicOn
                    ? "Turn background music off"
                    : "Turn background music on"
                }
                aria-pressed={bgMusicOn}
              >
                <span className="ambient-toggle-track">
                  <span className="ambient-toggle-thumb" />
                </span>
                <span className="ambient-toggle-label">
                  {bgMusicOn ? "ON" : "OFF"}
                </span>
              </button>
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
                  type="button"
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

                <button
                  type="button"
                  className="create-modal-btn"
                  onClick={enterCreatedRoom}
                >
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
