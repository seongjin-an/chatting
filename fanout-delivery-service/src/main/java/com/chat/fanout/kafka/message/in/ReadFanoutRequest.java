package com.chat.fanout.kafka.message.in;

import com.chat.fanout.kafka.message.KafkaMessage;
import java.util.List;

public record ReadFanoutRequest(
    Long channelId,
    String userId,
    Long lastReadMessageId,
    List<String> recipientIds
) implements KafkaMessage {

}
