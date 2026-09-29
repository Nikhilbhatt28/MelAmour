package com.melamour.backend.dto;

import java.time.LocalDateTime;

public class RoomResponse {

    private String roomCode;
    private String roomName;
    private String hostName;
    private String role;
    private boolean locked;
    private boolean active;
    private LocalDateTime createdAt;

    public RoomResponse() {
    }

    public RoomResponse(
            String roomCode,
            String roomName,
            String hostName,
            String role,
            boolean locked,
            boolean active,
            LocalDateTime createdAt) {
        this.roomCode = roomCode;
        this.roomName = roomName;
        this.hostName = hostName;
        this.role = role;
        this.locked = locked;
        this.active = active;
        this.createdAt = createdAt;
    }

    public String getRoomCode() {
        return roomCode;
    }

    public void setRoomCode(String roomCode) {
        this.roomCode = roomCode;
    }

    public String getRoomName() {
        return roomName;
    }

    public void setRoomName(String roomName) {
        this.roomName = roomName;
    }

    public String getHostName() {
        return hostName;
    }

    public void setHostName(String hostName) {
        this.hostName = hostName;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public boolean isLocked() {
        return locked;
    }

    public void setLocked(boolean locked) {
        this.locked = locked;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}