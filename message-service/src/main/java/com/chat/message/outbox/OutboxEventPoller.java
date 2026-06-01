package com.chat.message.outbox;

import com.chat.common.ContentMessage;
import com.chat.common.JsonUtil;
import com.chat.common.KeyPrefix;
import com.chat.message.kafka.KafkaProducer;
import com.chat.message.repository.channelmember.ChannelMemberRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@RequiredArgsConstructor
@Service
public class OutboxEventPoller {

    private final OutboxEventRepository outboxEventRepository;
    private final ChannelMemberRepository channelMemberRepository;
    private final KafkaProducer kafkaProducer;
    private final StringRedisTemplate redisTemplate;
    private final JsonUtil jsonUtil;

    @Scheduled(fixedDelay = 100)
    @Transactional
    public void poll() {
        // SKIP LOCKED: 다른 인스턴스가 잠근 row는 건너뜀
        List<OutboxEventEntity> events = outboxEventRepository.findPendingForUpdate();

        for (OutboxEventEntity event : events) {
            event.markInProgress();
        }
        // flush → 다른 인스턴스가 동일 row 집어가지 못하도록 확정

        for (OutboxEventEntity event : events) {
            try {
                ContentMessage contentMessage = jsonUtil.fromJson(event.getPayload(), ContentMessage.class)
                        .orElseThrow(() -> new IllegalStateException("payload 역직렬화 실패: " + event.getEventId()));

                channelMemberRepository.findByChannelId(contentMessage.channelId())
                        .forEach(member -> route(member.getUserId().toString(), contentMessage));

                event.markProcessed();
            } catch (Exception e) {
                log.error("[OutboxPoller] 처리 실패 eventId={}", event.getEventId(), e);
                event.markFailed(e.getMessage());
            }
        }
    }

    private void route(String userId, ContentMessage contentMessage) {
        log.info("userId={}, contentMessage={}", userId, contentMessage);
        Set<String> connectionKeys = redisTemplate.opsForSet().members(KeyPrefix.WEBSOCKET_USER + userId);
        if (connectionKeys == null || connectionKeys.isEmpty()) {
            return;
        }

        Set<String> instanceIds = new HashSet<>();
        for (String connectionKey : connectionKeys) {
            String connectionInfoJson = redisTemplate.opsForValue().get(KeyPrefix.WEBSOCKET_CONNECTION + connectionKey);
            if (connectionInfoJson == null) continue;

            jsonUtil.fromJson(connectionInfoJson, JsonNode.class)
                    .map(node -> node.get("instanceId"))
                    .map(JsonNode::asText)
                    .ifPresent(instanceIds::add);
        }

        instanceIds.forEach(instanceId ->
                kafkaProducer.sendContentMessageResponse(instanceId, userId, contentMessage));
    }
}
