package com.melamour.backend.controller;

import com.melamour.backend.dto.CreateRoomRequest;
import com.melamour.backend.dto.JoinRoomRequest;
import com.melamour.backend.dto.RoomResponse;
import com.melamour.backend.service.RoomService;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;

    public RoomController(
            RoomService roomService) {
        this.roomService = roomService;
    }

    @PostMapping
    public ResponseEntity<RoomResponse> createRoom(
            @Valid @RequestBody CreateRoomRequest request) {
        RoomResponse response = roomService.createRoom(request);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/join")
    public ResponseEntity<RoomResponse> joinRoom(
            @Valid @RequestBody JoinRoomRequest request) {
        RoomResponse response = roomService.joinRoom(request);

        return ResponseEntity.ok(response);
    }
}