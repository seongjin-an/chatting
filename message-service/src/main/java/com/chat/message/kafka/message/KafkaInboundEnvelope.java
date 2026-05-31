package com.chat.message.kafka.message;

import com.fasterxml.jackson.databind.JsonNode;

public record KafkaInboundEnvelope(String type, JsonNode payload) {}
