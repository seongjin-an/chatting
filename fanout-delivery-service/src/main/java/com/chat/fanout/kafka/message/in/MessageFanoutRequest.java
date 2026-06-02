package com.chat.fanout.kafka.message.in;

import com.chat.fanout.kafka.message.KafkaMessage;
import java.util.List;

public record MessageFanoutRequest(
    Long messageId,
    Long channelId,
    String senderId,
    String senderName,
    String content,
    Long createdAt,
    List<String> recipientIds
) implements KafkaMessage {}
