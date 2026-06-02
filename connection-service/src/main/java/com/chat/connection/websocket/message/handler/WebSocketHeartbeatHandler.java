package com.chat.connection.websocket.message.handler;

import com.chat.common.Constant;
import com.chat.common.UserId;
import com.chat.connection.service.CacheService;
import com.chat.connection.websocket.message.WebSocketMessageProcessor;
import com.chat.connection.websocket.message.payload.HeartbeatPayload;
import com.chat.connection.websocket.message.WebSocketMessageType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@RequiredArgsConstructor
@Component
public class WebSocketHeartbeatHandler implements WebSocketMessageProcessor<HeartbeatPayload> {

    private final CacheService cacheService;

    @Override
    public WebSocketMessageType getSupportedType() {
        return WebSocketMessageType.HEARTBEAT;
    }

    @Override
    public Class<HeartbeatPayload> getPayloadType() {
        return HeartbeatPayload.class;
    }

    @Override
    public void handle(WebSocketSession session, HeartbeatPayload message) {
        String connectionKey = (String) session.getAttributes().get(Constant.WEBSOCKET_CONNECTION_KEY);
        UserId userId = UserId.of((String) session.getAttributes().get(Constant.USER_ID));
        cacheService.refreshConnectionTtl(userId, connectionKey);
    }
}
