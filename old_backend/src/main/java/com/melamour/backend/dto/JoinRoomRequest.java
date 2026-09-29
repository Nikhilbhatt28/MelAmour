package com.melamour.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class JoinRoomRequest {

    @NotBlank(message = "Room code is required")
    @Size(min = 6, max = 6, message = "Room code must be 6 characters")
    private String roomCode;

    /*
     * Password is optional here because the room itself
     * may be public.
     *
     * RoomService will check whether the room actually
     * has a password before validating it.
     */
    @Size(max = 100, message = "Password cannot exceed 100 characters")
    private String password;

    @NotBlank(message = "Member name is required")
    @Size(min = 1, max = 50, message = "Member name must be between 1 and 50 characters")
    private String memberName;

    public JoinRoomRequest() {
    }

    public String getRoomCode() {
        return roomCode;
    }

    public void setRoomCode(String roomCode) {
        this.roomCode = roomCode;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getMemberName() {
        return memberName;
    }

    public void setMemberName(String memberName) {
        this.memberName = memberName;
    }
}