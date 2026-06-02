package com.chat.fanout.kafka.message.out;

import com.chat.common.ContentMessage;

public record ContentMessageResponsePayload(String userId, ContentMessage message) {}
