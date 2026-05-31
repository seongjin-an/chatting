package com.chat.message.domain;

import com.chat.message.domain.ChannelMemberEntity.ChannelMemberEntityId;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@AllArgsConstructor(access = AccessLevel.PRIVATE)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
@IdClass(ChannelMemberEntityId.class)
@Table(name = "channel_members")
@Entity
public class ChannelMemberEntity {

    @Id
    @Column(name = "channel_id", nullable = false)
    private Long channelId;

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    private LocalDateTime joinedAt;

    public static ChannelMemberEntity of(Long channelId, UUID userId) {
        return new ChannelMemberEntity(channelId, userId, LocalDateTime.now());
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    public static class ChannelMemberEntityId {
        private Long channelId;
        private UUID userId;

        @Override
        public boolean equals(Object o) {
            if (o == null || getClass() != o.getClass()) {
                return false;
            }
            ChannelMemberEntityId that = (ChannelMemberEntityId) o;
            return Objects.equals(channelId, that.channelId) && Objects.equals(userId,
                that.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(channelId, userId);
        }

        @Override
        public String toString() {
            return "ChannelMemberEntityId{" +
                "channelId=" + channelId +
                ", userId=" + userId +
                '}';
        }
    }
}
