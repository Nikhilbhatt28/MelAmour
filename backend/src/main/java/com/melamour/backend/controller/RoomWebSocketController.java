package com.melamour.backend.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class RoomWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;

    private final Map<String, Map<String, Map<String, Object>>> roomUsers = new ConcurrentHashMap<>();

    public RoomWebSocketController(
            SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/room")
    public void handleRoomEvent(
            @Payload Map<String, Object> event) {
        if (event == null) {
            return;
        }

        String type = getString(event, "type");
        String roomCode = getString(event, "roomCode");

        if (type == null || roomCode == null || roomCode.isBlank()) {
            return;
        }

        switch (type) {

            case "JOIN_ROOM":
                handleJoin(roomCode, event);
                break;

            case "LEAVE_ROOM":
                handleLeave(roomCode, event);
                break;

            default:
                broadcast(roomCode, event);
                break;
        }
    }

    private void handleJoin(
            String roomCode,
            Map<String, Object> event) {
        String clientId = getString(event, "clientId");

        if (clientId == null || clientId.isBlank()) {
            clientId = getString(event, "sender");
        }

        if (clientId == null || clientId.isBlank()) {
            return;
        }

        final String finalClientId = clientId;

        roomUsers
                .computeIfAbsent(
                        roomCode,
                        key -> new ConcurrentHashMap<>())
                .put(finalClientId, event);

        broadcast(roomCode, event);

        sendUserList(roomCode);
    }

    private void handleLeave(
            String roomCode,
            Map<String, Object> event) {
        String clientId = getString(event, "clientId");

        Map<String, Map<String, Object>> users = roomUsers.get(roomCode);

        if (users != null && clientId != null) {
            users.remove(clientId);

            if (users.isEmpty()) {
                roomUsers.remove(roomCode);
            }
        }

        broadcast(roomCode, event);

        sendUserList(roomCode);
    }

    private void sendUserList(
            String roomCode) {
        Map<String, Map<String, Object>> users = roomUsers.get(roomCode);

        if (users == null) {
            return;
        }

        Map<String, Object> response = new ConcurrentHashMap<>();

        response.put("type", "USER_LIST");
        response.put("roomCode", roomCode);
        response.put(
                "users",
                users.values());

        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode,
                response);
    }

    private void broadcast(
            String roomCode,
            Map<String, Object> event) {
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode,
                event);
    }

    private String getString(
            Map<String, Object> map,
            String key) {
        Object value = map.get(key);

        if (value == null) {
            return null;
        }

        return String.valueOf(value);
    }
}