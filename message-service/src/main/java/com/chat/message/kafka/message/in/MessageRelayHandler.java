package com.chat.message.kafka.message.in;

import com.chat.common.ContentMessage;
import com.chat.common.JsonUtil;
import com.chat.common.KeyPrefix;
import com.chat.message.domain.MessageEntity;
import com.chat.message.kafka.KafkaProducer;
import com.chat.message.kafka.message.KafkaMessageProcessor;
import com.chat.message.kafka.message.KafkaMessageType;
import com.chat.message.repository.channelmember.ChannelMemberRepository;
import com.chat.message.repository.message.MessageRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Set;
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
    private final ChannelMemberRepository channelMemberRepository;
    private final MessageRepository messageRepository;
    private final KafkaProducer kafkaProducer;
    private final JsonUtil jsonUtil;

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
        Long seq = redisTemplate.opsForValue().increment(SEQ_KEY_PREFIX + request.channelId());
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

        // 3. 채널 멤버 각각에게 라우팅
        ContentMessage contentMessage = new ContentMessage(
            seq, request.channelId(), request.senderId(), request.senderName(), request.content(), seq, now
        );

        channelMemberRepository.findByChannelId(request.channelId())
            .forEach(member -> routeToUserInstances(member.getUserId().toString(), contentMessage));
    }

    private void routeToUserInstances(String userId, ContentMessage message) {
        Set<String> connectionKeys = redisTemplate.opsForSet().members(KeyPrefix.WEBSOCKET_USER + userId);
        if (connectionKeys == null || connectionKeys.isEmpty()) {
            return; // 오프라인 유저 스킵
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

        instanceIds.forEach(instanceId -> kafkaProducer.sendContentMessageResponse(instanceId, userId, message));
    }
}
