```text
                          ┌─────────────────────────────────────┐
                          │         message-service             │
                          │                                     │
                          │  MessageEntity ──┐                  │
                          │  (MySQL)         │ @Transactional   │
                          │                 │                   │
                          │  OutboxEvent  ──┘                   │
                          │  (MySQL)  status=PENDING            │
                          └─────────────────────────────────────┘
                                            │
                                            │ poll (SKIP LOCKED)
                                            ▼
                          ┌─────────────────────────────────────┐
                          │        fanout-delivery-service      │
                          │                                     │
                          │  1. outbox PENDING 감지             │
                          │  2. 채널 멤버 조회                   │
                          │     userId: [A, B, C]               │
                          │  3. Redis 룩업                      │
                          │     A → instance-1                  │
                          │     B → instance-1                  │
                          │     C → instance-2                  │
                          │  4. 인스턴스별 그루핑 후 publish     │
                          └─────────────────────────────────────┘
                                   │                  │
                     ┌─────────────┘                  └─────────────┐
                     ▼                                              ▼
       Kafka: connection-instance-1              Kafka: connection-instance-2
                     │                                              │
                     ▼                                              ▼
       ┌─────────────────────────┐              ┌─────────────────────────┐
       │   connection-service    │              │   connection-service    │
       │      instance-1         │              │      instance-2         │
       │                         │              │                         │
       │  userA ──── WebSocket   │              │  userC ──── WebSocket   │
       │  userB ──── WebSocket   │              │                         │
       └─────────────────────────┘              └─────────────────────────┘
                     │                                              │
                     ▼                                              ▼
               [Browser A]                                    [Browser C]
               [Browser B]
```
