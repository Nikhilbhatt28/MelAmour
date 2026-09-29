package com.melamour.backend.repository;

import com.melamour.backend.entity.Room;
import com.melamour.backend.entity.RoomMember;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoomMemberRepository
        extends JpaRepository<RoomMember, Long> {

    List<RoomMember> findByRoom(Room room);

    List<RoomMember> findByRoomRoomCode(
            String roomCode);
}