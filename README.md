# MelAmour 🎵

> **Where hearts meet through music.**

MelAmour is a real-time collaborative music room where friends can create a private room, join together, and listen to music in sync.

## ✨ Features

* Create private rooms with optional password
* Host-controlled music playback
* Upload and stream songs
* Real-time Play / Pause / Seek synchronization
* Live room communication
* PostgreSQL database
* WebSocket-based real-time communication
* Dockerized deployment
* GitHub Actions CI
* Cloud deployment using Render

## 🏗️ Architecture

```
 Host / Guests
      │
      ▼
 React Frontend
      │
 ┌────┴──────────┐
 ▼               ▼
REST API      WebSocket
 │               │
 ▼               ▼
Spring Boot   Room Events
 │
 ├── PostgreSQL
 │
 └── Music Storage
```

**Audio** is streamed through the backend, while **WebSocket** handles playback synchronization between room members.

## 🛠️ Tech Stack

**Frontend:** React, Vite, JavaScript, CSS
**Backend:** Java, Spring Boot, WebSocket/STOMP
**Database:** PostgreSQL
**DevOps:** Docker, GitHub Actions
**Deployment:** Render

## 🚀 Run Locally

### Backend

```bash
cd backend
mvnw.cmd spring-boot:run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Or run the complete stack with:

```bash
docker compose up -d
```

## 🧪 Tests

Run backend tests:

```bash
cd backend
mvnw.cmd test
```

GitHub Actions automatically runs the tests on every push.

## 📌 Project Goal

MelAmour demonstrates **distributed communication, real-time messaging, containerization, database integration, CI/CD, and cloud deployment** in a practical application.
