package com.melamour.backend.service;

import com.melamour.backend.dto.CreateRoomRequest;
import com.melamour.backend.dto.JoinRoomRequest;
import com.melamour.backend.dto.RoomResponse;
import com.melamour.backend.entity.Room;
import com.melamour.backend.repository.RoomMemberRepository;
import com.melamour.backend.repository.RoomRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoomServiceTest {

    @Mock
    private RoomRepository roomRepository;

    @Mock
    private RoomMemberRepository roomMemberRepository;

    @InjectMocks
    private RoomService roomService;

    @Test
    void createRoomCreatesHostRoom() {
        CreateRoomRequest request = new CreateRoomRequest();
        request.setRoomName("Music Night");
        request.setHostName("Nikhil");
        request.setPassword("");

        when(roomRepository.existsByRoomCode(anyString())).thenReturn(false);
        when(roomRepository.save(any(Room.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RoomResponse response = roomService.createRoom(request);

        assertNotNull(response);
        assertEquals("Music Night", response.getRoomName());
        assertEquals("Nikhil", response.getHostName());
        assertEquals("HOST", response.getRole());
        assertEquals(6, response.getRoomCode().length());
        verify(roomMemberRepository).save(any());
    }

    @Test
    void publicRoomAllowsGuestWithoutPassword() {
        Room room = new Room();
        room.setRoomCode("ABC123");
        room.setRoomName("Public Room");
        room.setHostName("Host");
        room.setPassword("");
        room.setActive(true);
        room.setLocked(false);

        JoinRoomRequest request = new JoinRoomRequest();
        request.setRoomCode("abc123");
        request.setMemberName("Guest");

        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(room));

        RoomResponse response = roomService.joinRoom(request);

        assertEquals("ABC123", response.getRoomCode());
        assertEquals("GUEST", response.getRole());
        verify(roomMemberRepository).save(any());
    }

    @Test
    void protectedRoomRejectsWrongPassword() {
        Room room = new Room();
        room.setRoomCode("ABC123");
        room.setRoomName("Private Room");
        room.setHostName("Host");
        room.setPassword("secret");
        room.setActive(true);
        room.setLocked(false);

        JoinRoomRequest request = new JoinRoomRequest();
        request.setRoomCode("ABC123");
        request.setPassword("wrong");
        request.setMemberName("Guest");

        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(room));

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> roomService.joinRoom(request)
        );

        assertEquals("Invalid room password", error.getMessage());
        verify(roomMemberRepository, never()).save(any());
    }

    @Test
    void lockedRoomRejectsGuest() {
        Room room = new Room();
        room.setRoomCode("ABC123");
        room.setRoomName("Locked Room");
        room.setHostName("Host");
        room.setPassword("");
        room.setActive(true);
        room.setLocked(true);

        JoinRoomRequest request = new JoinRoomRequest();
        request.setRoomCode("ABC123");
        request.setMemberName("Guest");

        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(room));

        IllegalStateException error = assertThrows(
                IllegalStateException.class,
                () -> roomService.joinRoom(request)
        );

        assertEquals("Room is locked", error.getMessage());
        verify(roomMemberRepository, never()).save(any());
    }
}
