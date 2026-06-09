package com.chat.connection.kafka.message.in;

import com.chat.connection.kafka.message.KafkaMessage;

// userId: WebSocket 라우팅 대상(수신자), readerId: 실제로 읽은 사람
public record ReadEvent(String userId, Long channelId, String readerId, Long lastReadMessageId)
    implements KafkaMessage {

}
