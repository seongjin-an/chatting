package com.chat.message.kafka.message.in;

import com.chat.message.kafka.message.KafkaMessage;

public record MessageRelayRequest(
    String senderId,
    String senderName,
    Long channelId,
    String content,
    String instanceId
) implements KafkaMessage {}
