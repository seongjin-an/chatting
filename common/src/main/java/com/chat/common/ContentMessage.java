package com.chat.common;

public record ContentMessage(Long messageId, Long channelId, String senderId, String senderName, String content, Long seq, Long createdAt) {

}
