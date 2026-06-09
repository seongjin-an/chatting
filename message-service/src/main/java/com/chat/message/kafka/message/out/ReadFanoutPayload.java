package com.chat.message.kafka.message.out;

import java.util.List;

public record ReadFanoutPayload(Long channelId, String userId, Long lastReadMessageId, List<String> recipientIds) {

}
