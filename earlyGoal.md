```
  REST API

  채팅방
  - POST /api/rooms — 채팅방 생성
  - GET /api/rooms — 내가 속한 채팅방 목록
  - GET /api/rooms/{roomId} — 채팅방 단건 조회
  - DELETE /api/rooms/{roomId} — 채팅방 삭제

  채팅방 멤버
  - POST /api/rooms/{roomId}/members — 채팅방 입장 (멤버 추가)
  - DELETE /api/rooms/{roomId}/members/me — 채팅방 퇴장
  - GET /api/rooms/{roomId}/members — 멤버 목록 조회

  메시지 히스토리
  - GET /api/rooms/{roomId}/messages?fromSeq=&limit= — 메시지 히스토리 (방 입장 시 프론트가 호출)

  ---
  Kafka

  - 컨슘 — message-relay (커넥션 서비스에서 받음)
  - 프로듀스 — connection-instance-{serverId} (커넥션 서비스로 보냄)

  ---
  내부 처리 (메시지 릴레이 플로우)

  message-relay 컨슘 시:
  1. seq 생성 (Redis INCR)
  2. DB 저장
  3. room_members 조회 → 멤버 목록 확보
  4. 각 멤버별 Redis에서 연결 인스턴스 조회 (ws:user:{userId})
  5. 인스턴스별로 connection-instance-{serverId} 토픽에 발행

  ---
  인프라

  ┌────────┬─────────────────────────────────────────────────────────┐
  │        │                          용도                           │
  ├────────┼─────────────────────────────────────────────────────────┤
  │ MySQL  │ rooms, room_members, messages                           │
  ├────────┼─────────────────────────────────────────────────────────┤
  │ Redis  │ seq 생성 + 연결 인스턴스 조회 (커넥션 서비스가 이미 씀) │
  ├────────┼─────────────────────────────────────────────────────────┤
  │ Kafka  │ message-relay 컨슘 / connection-instance-N 프로듀스     │
  ├────────┼─────────────────────────────────────────────────────────┤
  │ Eureka │ 서비스 등록                                             │
  └────────┴─────────────────────────────────────────────────────────┘
```