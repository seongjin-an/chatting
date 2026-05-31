package com.chat.message.kafka;

import com.chat.common.ContentMessage;
import com.chat.common.JsonUtil;
import com.chat.message.kafka.message.KafkaInboundEnvelope;
import com.chat.message.kafka.message.out.ContentMessageResponsePayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@RequiredArgsConstructor
@Service
public class KafkaProducer {

    private static final String CONTENT_MESSAGE_RESPONSE_TYPE = "CONTENT_MESSAGE_RESPONSE";

    @Value("${chatting.kafka.topics.connection-instance-prefix}")
    private String connectionInstancePrefix;

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final JsonUtil jsonUtil;

    public void sendContentMessageResponse(String instanceId, String userId, ContentMessage message) {
        ContentMessageResponsePayload payload = new ContentMessageResponsePayload(userId, message);
        KafkaInboundEnvelope envelope = new KafkaInboundEnvelope(
            CONTENT_MESSAGE_RESPONSE_TYPE,
            jsonUtil.convertJsonNode(payload).orElseThrow()
        );
        String json = jsonUtil.toJson(envelope).orElseThrow();
        kafkaTemplate.send(connectionInstancePrefix + instanceId, userId, json);
    }
}
