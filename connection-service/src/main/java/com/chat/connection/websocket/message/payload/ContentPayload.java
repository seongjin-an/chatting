package com.chat.connection.websocket.message.payload;

import com.chat.connection.websocket.message.WebSocketMessage;

public record ContentPayload(Long channelId, String content) implements WebSocketMessage {

}
