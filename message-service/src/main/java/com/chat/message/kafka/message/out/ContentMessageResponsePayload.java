package com.chat.message.kafka.message.out;

import com.chat.common.ContentMessage;

public record ContentMessageResponsePayload(String userId, ContentMessage message) {}
