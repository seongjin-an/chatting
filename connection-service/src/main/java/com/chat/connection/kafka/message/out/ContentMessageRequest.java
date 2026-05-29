package com.chat.connection.kafka.message.out;

import com.chat.common.UserId;
import com.chat.connection.kafka.message.KafkaMessage;
import com.chat.connection.websocket.message.payload.ContentPayload;
import lombok.Builder;

@Builder
public record ContentMessageRequest(String senderId, Long roomId, String content, String instanceId) implements
    KafkaMessage {

    public static ContentMessageRequest of(String senderId, Long roomId, String content, String instanceId) {
        return new ContentMessageRequest(senderId, roomId, content, instanceId);
    }

    public static ContentMessageRequest of(UserId senderId, ContentPayload payload, String instanceId) {
        return new ContentMessageRequest(senderId.id(), payload.roomId(), payload.content(), instanceId);
    }
}
