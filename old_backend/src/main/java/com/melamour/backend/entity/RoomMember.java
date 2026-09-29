package com.melamour.backend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "room_members")
public class RoomMember {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @ManyToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "room_id", nullable = false)
        private Room room;

        @Column(name = "member_name", nullable = false, length = 50)
        private String memberName;

        @Column(nullable = false, length = 20)
        private String role;

        @Column(name = "joined_at", nullable = false)
        private LocalDateTime joinedAt;

        @PrePersist
        protected void onCreate() {
                if (joinedAt == null) {
                        joinedAt = LocalDateTime.now();
                }
        }

        public RoomMember() {
        }

        public Long getId() {
                return id;
        }

        public void setId(Long id) {
                this.id = id;
        }

        public Room getRoom() {
                return room;
        }

        public void setRoom(Room room) {
                this.room = room;
        }

        public String getMemberName() {
                return memberName;
        }

        public void setMemberName(String memberName) {
                this.memberName = memberName;
        }

        public String getRole() {
                return role;
        }

        public void setRole(String role) {
                this.role = role;
        }

        public LocalDateTime getJoinedAt() {
                return joinedAt;
        }

        public void setJoinedAt(LocalDateTime joinedAt) {
                this.joinedAt = joinedAt;
        }
}