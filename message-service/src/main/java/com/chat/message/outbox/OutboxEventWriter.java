package com.chat.message.outbox;

import com.chat.common.ContentMessage;
import com.chat.common.JsonUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@RequiredArgsConstructor
@Service
public class OutboxEventWriter {

    private final OutboxEventRepository outboxEventRepository;
    private final JsonUtil jsonUtil;

    // 반드시 호출자(MessageRelayHandler)의 트랜잭션에 참여해야 원자성 보장
    @Transactional(propagation = Propagation.MANDATORY)
    public void write(ContentMessage contentMessage) {
        String payload = jsonUtil.toJson(contentMessage)
                .orElseThrow(() -> new IllegalStateException("ContentMessage 직렬화 실패"));

        OutboxEventEntity event = OutboxEventEntity.create(
                "MESSAGE",
                contentMessage.channelId() + ":" + contentMessage.messageId(),
                "MESSAGE_CREATED",
                payload
        );

        outboxEventRepository.save(event);
    }
}
