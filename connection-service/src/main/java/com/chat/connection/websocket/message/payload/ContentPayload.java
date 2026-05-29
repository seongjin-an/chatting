package com.chat.connection.websocket.message.payload;

import com.chat.connection.websocket.message.WebSocketMessage;

public record ContentPayload(Long roomId, String content) implements WebSocketMessage {

}
