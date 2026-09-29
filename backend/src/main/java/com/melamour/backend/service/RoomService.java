package com.melamour.backend.service;

import com.melamour.backend.dto.CreateRoomRequest;
import com.melamour.backend.dto.JoinRoomRequest;
import com.melamour.backend.dto.RoomResponse;
import com.melamour.backend.entity.Room;
import com.melamour.backend.entity.RoomMember;
import com.melamour.backend.repository.RoomMemberRepository;
import com.melamour.backend.repository.RoomRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;

@Service
@Transactional
public class RoomService {

        private static final String ROOM_CODE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        private static final int ROOM_CODE_LENGTH = 6;

        private final RoomRepository roomRepository;
        private final RoomMemberRepository roomMemberRepository;

        private final SecureRandom secureRandom = new SecureRandom();

        public RoomService(
                        RoomRepository roomRepository,
                        RoomMemberRepository roomMemberRepository) {
                this.roomRepository = roomRepository;
                this.roomMemberRepository = roomMemberRepository;
        }

        public RoomResponse createRoom(
                        CreateRoomRequest request) {
                String roomCode = generateUniqueRoomCode();

                Room room = new Room();

                room.setRoomCode(roomCode);

                room.setRoomName(
                                request.getRoomName().trim());

                String password = request.getPassword();

                if (password == null) {
                        password = "";
                }

                room.setPassword(password.trim());

                room.setHostName(
                                request.getHostName().trim());

                room.setLocked(false);
                room.setActive(true);

                Room savedRoom = roomRepository.save(room);

                RoomMember host = new RoomMember();

                host.setRoom(savedRoom);

                host.setMemberName(
                                savedRoom.getHostName());

                host.setRole("HOST");

                roomMemberRepository.save(host);

                return toResponse(
                                savedRoom,
                                "HOST");
        }

        public RoomResponse joinRoom(
                        JoinRoomRequest request) {
                String roomCode = request.getRoomCode()
                                .trim()
                                .toUpperCase();

                Room room = roomRepository
                                .findByRoomCode(roomCode)
                                .orElseThrow(
                                                () -> new IllegalArgumentException(
                                                                "Room not found"));

                if (!room.isActive()) {
                        throw new IllegalStateException(
                                        "Room is no longer active");
                }

                if (room.isLocked()) {
                        throw new IllegalStateException(
                                        "Room is locked");
                }

                /*
                 * Empty room password means the room is public.
                 */
                boolean protectedRoom = room.getPassword() != null
                                && !room.getPassword().isBlank();

                if (protectedRoom) {

                        String providedPassword = request.getPassword();

                        if (providedPassword == null
                                        || providedPassword.isBlank()) {

                                throw new IllegalArgumentException(
                                                "Password is required for this room");
                        }

                        if (!room.getPassword()
                                        .equals(providedPassword)) {

                                throw new IllegalArgumentException(
                                                "Invalid room password");
                        }
                }

                RoomMember member = new RoomMember();

                member.setRoom(room);

                member.setMemberName(
                                request.getMemberName().trim());

                member.setRole("GUEST");

                roomMemberRepository.save(member);

                return toResponse(
                                room,
                                "GUEST");
        }

        private RoomResponse toResponse(
                        Room room,
                        String role) {
                return new RoomResponse(
                                room.getRoomCode(),
                                room.getRoomName(),
                                room.getHostName(),
                                role,
                                room.isLocked(),
                                room.isActive(),
                                room.getCreatedAt());
        }

        private String generateUniqueRoomCode() {

                String roomCode;

                do {
                        StringBuilder builder = new StringBuilder(
                                        ROOM_CODE_LENGTH);

                        for (int i = 0; i < ROOM_CODE_LENGTH; i++) {

                                int index = secureRandom.nextInt(
                                                ROOM_CODE_CHARACTERS.length());

                                builder.append(
                                                ROOM_CODE_CHARACTERS.charAt(index));
                        }

                        roomCode = builder.toString();

                } while (roomRepository
                                .existsByRoomCode(roomCode));

                return roomCode;
        }
}