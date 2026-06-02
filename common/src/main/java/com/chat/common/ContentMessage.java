package com.chat.common;

public record ContentMessage(String messageId, Long channelId, String senderId, String senderName, String content, Long createdAt) {

    public static ContentMessage of(String messageId, Long channelId, String senderId, String senderName, String content, Long createdAt) {
        return new ContentMessage(messageId, channelId, senderId, senderName, content, createdAt);
    }
}
