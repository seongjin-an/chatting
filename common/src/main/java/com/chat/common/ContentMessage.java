package com.chat.common;

public record ContentMessage(Long messageId, Long channelId, String senderId, String senderName, String content, Long seq, Long createdAt) {

    public static ContentMessage of(Long messageId, Long channelId, String senderId, String senderName, String content, Long seq, Long createdAt) {
        return new ContentMessage(messageId, channelId, senderId, senderName, content, seq, createdAt);
    }
}
