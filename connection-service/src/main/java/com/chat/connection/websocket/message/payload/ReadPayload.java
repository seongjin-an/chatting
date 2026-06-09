package com.chat.connection.websocket.message.payload;

import com.chat.connection.websocket.message.WebSocketMessage;

public record ReadPayload(Long channelId, Long messageId) implements WebSocketMessage {

}
