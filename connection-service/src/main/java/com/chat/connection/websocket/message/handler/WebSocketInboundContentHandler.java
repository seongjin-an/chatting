package com.chat.connection.websocket.message.handler;

import com.chat.common.Constant;
import com.chat.common.UserId;
import com.chat.connection.kafka.message.out.ContentMessageRequest;
import com.chat.connection.kafka.KafkaProducer;
import com.chat.connection.websocket.message.WebSocketMessageType;
import com.chat.connection.websocket.message.WebSocketMessageProcessor;
import com.chat.connection.websocket.message.payload.ContentPayload;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@RequiredArgsConstructor
@Component
public class WebSocketInboundContentHandler implements WebSocketMessageProcessor<ContentPayload> {

    @Value("${server.id}")
    private String serverId;

    private final KafkaProducer kafkaProducer;

    @Override
    public WebSocketMessageType getSupportedType() {
        return WebSocketMessageType.SEND_MESSAGE;
    }

    @Override
    public Class<ContentPayload> getPayloadType() {
        return ContentPayload.class;
    }

    @Override
    public void handle(WebSocketSession session, ContentPayload payload) {
        String userId = (String) session.getAttributes().get(Constant.USER_ID);
        // 카프카로 전송
        ContentMessageRequest contentMessageRequest = ContentMessageRequest.of(UserId.of(userId), payload, serverId);
        kafkaProducer.sendContentPayloadByPartitionKey(contentMessageRequest);
    }
}
