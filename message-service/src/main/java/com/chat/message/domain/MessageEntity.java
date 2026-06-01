package com.chat.message.domain;

import com.chat.message.domain.MessageEntity.MessageEntityId;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@AllArgsConstructor(access = AccessLevel.PRIVATE)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
@IdClass(MessageEntityId.class)
@Table(name = "message")
@Entity
public class MessageEntity extends BaseEntity{
    @Id
    @Column(name = "channel_id", nullable = false)
    private Long channelId;

    @Id
    @Column(name = "message_id", nullable = false)
    private Long messageId; // Redis INCR

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "user_name", nullable = false)
    private String userName;

    @Column(name = "content", nullable = false)
    private String content;

    public static MessageEntity of(Long channelId, Long messageId, UUID userId, String userName, String content) {
        return new MessageEntity(channelId, messageId, userId, userName, content);
    }

    @AllArgsConstructor(access = AccessLevel.PRIVATE)
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @Getter
    public static class MessageEntityId implements Serializable {
        private Long channelId;
        private Long messageId;

        public static MessageEntityId of(Long channelId, Long messageId) {
            return new MessageEntityId(channelId, messageId);
        }

        @Override
        public boolean equals(Object o) {
            if (o == null || getClass() != o.getClass()) {
                return false;
            }
            MessageEntityId that = (MessageEntityId) o;
            return Objects.equals(channelId, that.channelId) && Objects.equals(messageId,
                that.messageId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(channelId, messageId);
        }

        @Override
        public String toString() {
            return "MessageEntityId{" +
                "channelId=" + channelId +
                ", messageId=" + messageId +
                '}';
        }
    }
}
