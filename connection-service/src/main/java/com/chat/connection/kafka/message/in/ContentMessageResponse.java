package com.chat.connection.kafka.message.in;

import com.chat.common.ContentMessage;
import com.chat.connection.kafka.message.KafkaMessage;

public record ContentMessageResponse(String userId, ContentMessage message) implements KafkaMessage {


}
