```text
  [철수 Client]
       │
       │ ① WS IN
       │   {"type":"SEND_MESSAGE", "payload":{"roomId":1, "content":"안녕"}}
       ▼
  [ConnectionService-A]
       │
       │ ② Kafka OUT
       │   chat-inbound 토픽
       │   {senderId, roomId, content, instanceId-A}
       ▼
  [MessageService]
       ├── 메시지 MySQL 저장
       ├── ChatRoomMember 조회 → 철수, 영희, 민수
       ├── Redis 조회
       │     user:영희 → instanceId-A
       │     user:민수 → instanceId-B
       │
       │ ③ Kafka OUT (MessageService → ConnectionService)
       ├──▶ chat-route-A 토픽 {영희에게 전달할 메시지}
       └──▶ chat-route-B 토픽 {민수에게 전달할 메시지}

            ③ Kafka IN (ConnectionService 입장)
            ▼                        ▼
  [ConnectionService-A]    [ConnectionService-B]
    SessionRegistry에서       SessionRegistry에서
    영희 세션 조회             민수 세션 조회
       │                        │
       │ ④ WS OUT               │ ④ WS OUT
       ▼                        ▼
  [영희 Client]            [민수 Client]
```
