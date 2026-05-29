package com.chat.common;

public record ContentMessage(Long messageId, Long roomId, String senderId, String senderName, String content, Long seq, Long createdAt) {

}
