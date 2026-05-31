package com.chat.connection.kafka;

import com.chat.common.JsonUtil;
import com.chat.connection.kafka.message.KafkaEnvelope;
import com.chat.connection.kafka.message.KafkaMessage;
import com.chat.connection.kafka.message.KafkaMessageType;
import com.chat.connection.kafka.message.out.ContentMessageRequest;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class KafkaProducer {
    private final String messageTopic;
    private final JsonUtil jsonUtil;
    private final KafkaTemplate<String, String> kafkaTemplate;

    public KafkaProducer(
        @Value("${chatting.kafka.topics.message}") String messageTopic,
        JsonUtil jsonUtil,
        KafkaTemplate<String, String> kafkaTemplate
    ) {
        this.messageTopic = messageTopic;
        this.jsonUtil = jsonUtil;
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendContentPayloadByPartitionKey(ContentMessageRequest contentMessageRequest) {

        KafkaEnvelope kafkaEnvelope = getKafkaEnvelope(KafkaMessageType.CONTENT_MESSAGE_RELAY.name(), contentMessageRequest);
        String value = jsonUtil.toJson(kafkaEnvelope).orElseThrow();
        String partitionKey = "%d-%s".formatted(contentMessageRequest.channelId(), contentMessageRequest.senderId());
        kafkaTemplate.send(messageTopic, partitionKey, value);
    }

    private <T extends KafkaMessage> KafkaEnvelope getKafkaEnvelope(String type, T kafkaMessage) {
        JsonNode jsonNode = jsonUtil.convertJsonNode(kafkaMessage).orElseThrow();
        return new KafkaEnvelope(type, jsonNode);
    }
}
