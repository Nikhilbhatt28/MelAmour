package com.melamour.backend.repository;

import com.melamour.backend.entity.Room;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoomRepository
        extends JpaRepository<Room, Long> {

    Optional<Room> findByRoomCode(
            String roomCode);

    boolean existsByRoomCode(
            String roomCode);
}