package com.melamour.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateRoomRequest {

    @NotBlank(message = "Room name is required")
    @Size(min = 1, max = 100, message = "Room name must be between 1 and 100 characters")
    private String roomName;

    /*
     * Password is optional.
     *
     * Empty password -> public room
     * 4+ characters -> password-protected room
     */
    @Size(max = 100, message = "Password cannot exceed 100 characters")
    private String password;

    @NotBlank(message = "Host name is required")
    @Size(min = 1, max = 50, message = "Host name must be between 1 and 50 characters")
    private String hostName;

    public CreateRoomRequest() {
    }

    public String getRoomName() {
        return roomName;
    }

    public void setRoomName(String roomName) {
        this.roomName = roomName;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getHostName() {
        return hostName;
    }

    public void setHostName(String hostName) {
        this.hostName = hostName;
    }
}