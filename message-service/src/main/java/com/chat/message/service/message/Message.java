package com.chat.message.service.message;

import com.chat.message.domain.MessageEntity;
import java.time.ZoneOffset;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Getter
public class Message {
    private final Long channelId;
    private final Long messageId;
    private final String userId;
    private final String userName;
    private final String content;
    private final long createdAt; // epoch ms

    public static Message of(MessageEntity entity) {
        long createdAt = entity.getCreatedAt() != null
            ? entity.getCreatedAt().toInstant(ZoneOffset.UTC).toEpochMilli()
            : System.currentTimeMillis();
        return new Message(
            entity.getChannelId(),
            entity.getMessageId(),
            entity.getUserId().toString(),
            entity.getUserName(),
            entity.getContent(),
            createdAt
        );
    }
}
