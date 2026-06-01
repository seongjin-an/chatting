package com.chat.message.outbox;

public enum OutboxStatus {
    PENDING,
    IN_PROGRESS,
    PROCESSED,
    FAILED
}
