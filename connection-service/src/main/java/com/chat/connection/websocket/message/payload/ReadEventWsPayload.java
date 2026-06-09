package com.chat.connection.websocket.message.payload;

public record ReadEventWsPayload(Long channelId, String userId, Long lastReadMessageId) {

}
