package com.chat.connection.kafka.message.in;

import com.chat.common.JsonUtil;
import com.chat.common.UserId;
import com.chat.connection.kafka.message.KafkaMessageProcessor;
import com.chat.connection.kafka.message.KafkaMessageType;
import com.chat.connection.websocket.WebSocketSessionRegistry;
import java.io.IOException;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Slf4j
@RequiredArgsConstructor
@Service
public class ContentMessageResponseHandler implements KafkaMessageProcessor<ContentMessageResponse> {

    private final WebSocketSessionRegistry webSocketSessionRegistry;
    private final JsonUtil jsonUtil;

    @Override
    public KafkaMessageType getSupportedType() {
        return KafkaMessageType.CONTENT_MESSAGE_RESPONSE;
    }

    @Override
    public Class<ContentMessageResponse> getPayloadType() {
        return ContentMessageResponse.class;
    }

    @Override
    public void handle(ContentMessageResponse message) {
        UserId userId = UserId.of(message.userId());
        Map<String, WebSocketSession> userSessions = webSocketSessionRegistry.getSessions(userId);

        if (userSessions.isEmpty()) {
            log.debug("No active sessions for userId={}", message.userId());
            return;
        }

        String payload = jsonUtil.toJson(message.message()).orElseThrow();
        TextMessage textMessage = new TextMessage(payload);

        userSessions.values().forEach(session -> {
            try {
                if (session.isOpen()) {
                    session.sendMessage(textMessage);
                }
            } catch (IOException e) {
                log.error("Failed to deliver message to userId={}, sessionId={}: {}",
                    message.userId(), session.getId(), e.getMessage());
            }
        });
    }
}
