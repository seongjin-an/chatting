package com.chat.message.outbox;

import com.chat.common.ContentMessage;
import java.util.List;

public record OutboxPayload(
    String messageId,
    Long channelId,
    String senderId,
    String senderName,
    String content,
    Long createdAt,
    List<String> recipientIds
) {
    public static OutboxPayload of(ContentMessage contentMessage, List<String> recipientIds) {
        return new OutboxPayload(
            contentMessage.messageId(),
            contentMessage.channelId(),
            contentMessage.senderId(),
            contentMessage.senderName(),
            contentMessage.content(),
            contentMessage.createdAt(),
            recipientIds
        );
    }
}
