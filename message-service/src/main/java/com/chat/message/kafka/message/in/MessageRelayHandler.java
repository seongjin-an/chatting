package com.chat.message.kafka.message.in;

import com.chat.common.ContentMessage;
import com.chat.message.domain.MessageEntity;
import com.chat.message.kafka.message.KafkaMessageProcessor;
import com.chat.message.kafka.message.KafkaMessageType;
import com.chat.message.outbox.OutboxEventWriter;
import com.chat.message.repository.message.MessageRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@RequiredArgsConstructor
@Component
public class MessageRelayHandler implements KafkaMessageProcessor<MessageRelayRequest> {

    private static final String SEQ_KEY_PREFIX = "channel:seq:";

    private final StringRedisTemplate redisTemplate;
    private final MessageRepository messageRepository;
    private final OutboxEventWriter outboxEventWriter;

    @Override
    public KafkaMessageType getSupportedType() {
        return KafkaMessageType.CONTENT_MESSAGE_RELAY;
    }

    @Override
    public Class<MessageRelayRequest> getPayloadType() {
        return MessageRelayRequest.class;
    }

    @Override
    @Transactional
    public void handle(MessageRelayRequest request) {
        // 1. 채팅방 seq 생성
        String seqKey = SEQ_KEY_PREFIX + request.channelId();
        Long seq = redisTemplate.opsForValue().increment(seqKey);
        if (seq == null) {
            throw new IllegalStateException("Failed to generate seq for room: " + request.channelId());
        }

        // 2. 메시지 저장
        long now = System.currentTimeMillis();
        MessageEntity messageEntity = MessageEntity.of(
            request.channelId(),
            seq,
            UUID.fromString(request.senderId()),
            request.senderName(),
            request.content()
        );
        messageRepository.save(messageEntity);

        // 3. Outbox 저장 (같은 트랜잭션 — 메시지 저장과 원자적으로 묶임)
        ContentMessage contentMessage = new ContentMessage(
            seq, request.channelId(), request.senderId(), request.senderName(), request.content(), seq, now
        );
        outboxEventWriter.write(contentMessage);
    }
}
