package com.chat.connection.kafka;

import com.chat.common.JsonUtil;
import com.chat.connection.kafka.message.out.ContentMessageRequest;
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
        String value = jsonUtil.toJson(contentMessageRequest).orElseThrow();
        String partitionKey = "%d-%s".formatted(contentMessageRequest.roomId(), contentMessageRequest.senderId());
        kafkaTemplate.send(messageTopic, partitionKey, value);
    }
}
