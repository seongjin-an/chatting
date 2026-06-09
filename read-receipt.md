# 읽음 확인 (Read Receipt) 설계 문서

---

## 목차

- 핵심 설계 원칙
- 데이터 모델
- 전체 흐름 (6단계)
- 읽음 기준 — 클라이언트 주도 설계
- WebSocket 메시지 포맷
- Kafka 토픽 구조
- Redis 키 구조
- 프론트엔드 상태 관리
- 읽은 사람 / 안 읽은 사람 계산 방식

---

## 핵심 설계 원칙

**"딜리버리(delivery) ≠ 읽음(read)"**

메시지가 WebSocket으로 전달됐다고 해서 읽은 것이 아니다.  
사용자가 실제로 채팅방 페이지를 보고 있을 때만 읽음으로 처리한다.

### 클라이언트 주도 vs 서버 주도

| 방식 | 읽음 트리거 | 문제점 |
|------|-----------|-------|
| 서버 주도 | WebSocket 딜리버리 성공 시 서버가 자동 처리 | 채팅방 밖에서도 "읽음" 처리됨 |
| **클라이언트 주도 (채택)** | 브라우저가 채팅방 페이지에 있을 때 명시적으로 READ_MESSAGE 전송 | 없음 |

---

## 데이터 모델

### DB — `channel_member` 테이블

```sql
ALTER TABLE channel_member
  ADD COLUMN last_read_message_id BIGINT NULL;
```

**"채널별 사용자의 마지막 읽은 messageId"** 를 단일 값으로 저장.  
별도 read 테이블 없이 이 값 하나로 모든 읽음 상태를 추론한다.

```
메시지 M을 읽었는지 여부:
  last_read_message_id >= M.message_id → 읽음
  last_read_message_id <  M.message_id → 안읽음
```

Snowflake ID가 시간 순서대로 단조증가하므로, 하나의 High-Watermark 값으로  
이전 모든 메시지의 읽음 상태를 O(1)로 판단할 수 있다.

### Redis — 빠른 읽음 상태 접근

```
키: read:{channelId}:{userId}
값: lastReadMessageId (String)
TTL: 없음 (채널 탈퇴 시 이벤트 기반으로 삭제)
```

---

## 전체 흐름 (6단계)

### 읽음 트리거 발생 조건

| 시나리오 | 트리거 |
|----------|--------|
| 채팅방 입장 (히스토리 로드 완료) | 히스토리 최신 messageId로 READ_MESSAGE 전송 |
| 채팅방에 있는 동안 새 메시지 수신 | wsMessages 변경 → 최신 messageId로 READ_MESSAGE 전송 |
| 채팅방 밖에서 메시지 수신 | 읽음 처리 없음 |

---

### 1단계 — 브라우저 → connection-service (READ_MESSAGE)

채팅방 페이지(`page.tsx`)의 `useEffect`가 조건 충족 시 WebSocket으로 READ_MESSAGE를 전송한다.

```
// 채팅방 입장 시
historyResult 로드 완료 + WebSocket 연결됨
  → sendWebSocketMessage({ type: "READ_MESSAGE", payload: { channelId, messageId } })

// 채팅방에 있는 동안 새 메시지 수신 시
wsMessages 변경 (새 메시지 추가)
  → sendWebSocketMessage({ type: "READ_MESSAGE", payload: { channelId, messageId } })
```

---

### 2단계 — connection-service → Kafka [read-relay]

```
WebSocketHandler.handleTextMessage()
  → WebSocketDispatcher
  → WebSocketMessageType.READ_MESSAGE
  → WebSocketInboundReadHandler.handle()
      payload: { channelId: 5, messageId: 5039516823322624 }
      session에서 userId 추출
  → kafkaProducer.sendReadRelay({
        channelId: 5,
        userId: "6b180b0b-...",
        messageId: 5039516823322624
    })
  → Kafka [read-relay] 발행 (파티션 키: channelId)
```

---

### 3단계 — message-service: DB/Redis 갱신 + Kafka [read-fanout] 발행

```
ReadRelayHandler.handle()  [@Transactional]
  │
  ├── DB 갱신
  │     channel_member 조회 (findByChannelIdAndUserId)
  │     entity.updateLastReadMessageId(messageId)
  │
  ├── Redis 갱신
  │     SET read:5:6b180b0b-... 5039516823322624
  │
  └── 채널 전체 멤버 조회 (Redis 캐시 or DB)
        channelMemberCacheService.getRecipientIds(channelId)
        → ["71a76f02-...", "6b180b0b-..."]
        ↓
        kafkaProducer.sendReadFanout({
            channelId: 5,
            userId: "6b180b0b-...",       ← 읽은 사람
            lastReadMessageId: 5039516823322624,
            recipientIds: [...]            ← 이벤트를 받아야 할 채널 멤버
        })
        → Kafka [read-fanout] 발행
```

---

### 4단계 — fanout-delivery-service: 인스턴스별 라우팅

```
ReadFanoutHandler.handle()
  │
  recipientIds 순회 → 각 멤버의 connection-instance 토픽으로 라우팅
  │
  ├── 각 userId에 대해:
  │     Redis ws:user:{userId} → connectionKey Set 조회
  │     Redis ws:connection:{key} → instanceId 조회
  │     stale connectionKey 자동 제거 (TTL 만료 항목)
  │
  └── kafkaProducer.sendReadEvent(instanceId, recipientUserId, channelId, readerId, lastReadMessageId)
        → Kafka [connection-instance-{instanceId}] 발행
```

---

### 5단계 — connection-service: WebSocket으로 READ_EVENT 푸시

```
ReadEventHandler.handle()
  │
  ├── message.userId() = 수신 대상 userId
  │     WebSocketSessionRegistry에서 해당 유저 세션 조회
  │
  └── WebSocket 푸시:
        {
          type: "READ_EVENT",
          payload: {
            channelId: 5,
            userId: "6b180b0b-...",           ← 실제로 읽은 사람 (readerId)
            lastReadMessageId: 5039516823322624
          }
        }
```

읽은 사람 본인 포함 채널 전체 멤버에게 READ_EVENT가 전달된다.

---

### 6단계 — 브라우저: Zustand 상태 갱신 + 리렌더링

```
handleInbound({ type: "READ_EVENT", payload })
  → applyReadEvent({ channelId, userId: "6b180b0b-...", lastReadMessageId })
  → readState["5"]["6b180b0b-..."] = 5039516823322624

Zustand store 변경
  → ChatRoomPage 리렌더링
  → getUnreadCount() 재계산
  → 메시지 옆 미읽음 숫자 업데이트
  → ReadReceiptSheet 열려있으면 실시간 반영
```

---

## 읽음 기준 — 클라이언트 주도 설계

### 핵심: 페이지 마운트 = 보고 있음

```typescript
// page.tsx

// 1. 채팅방 입장 시 히스토리 최신 메시지까지 읽음 처리
useEffect(() => {
  if (!connected || !historyResult?.messages?.length) return;
  const latest = historyResult.messages.reduce((a, b) =>
    BigInt(a.messageId) > BigInt(b.messageId) ? a : b
  );
  sendWebSocketMessage({
    type: "READ_MESSAGE",
    payload: { channelId: Number(channelId), messageId: Number(latest.messageId) },
  });
}, [historyResult, connected]);

// 2. 채팅방에 있는 동안 새 메시지 수신 시 읽음 처리
useEffect(() => {
  if (!connected || wsMessages.length === 0) return;
  const latest = wsMessages.reduce((a, b) =>
    BigInt(a.messageId) > BigInt(b.messageId) ? a : b
  );
  sendWebSocketMessage({
    type: "READ_MESSAGE",
    payload: { channelId: Number(channelId), messageId: Number(latest.messageId) },
  });
}, [wsMessages]);
```

`useEffect`는 컴포넌트가 마운트된 동안만 실행된다.  
사용자가 뒤로가기로 채팅방을 떠나면 컴포넌트가 언마운트되어 자연스럽게 신호가 끊긴다.

### WebSocket 연결과의 분리

WebSocket은 앱 레벨(`providers.tsx`)에서 관리되어 페이지 이동 후에도 연결이 유지된다.  
읽음 처리는 WebSocket 연결 유무가 아니라 **채팅방 페이지 마운트 여부**로 판단한다.

| 상태 | 메시지 수신 | 읽음 처리 |
|------|------------|---------|
| 채팅방 페이지 열려있음 | ✅ | ✅ |
| 다른 페이지에 있음 (WebSocket 연결 유지) | ✅ (WebSocket으로 수신) | ❌ |
| WebSocket 연결 끊김 | ❌ | ❌ |

---

## WebSocket 메시지 포맷

### 클라이언트 → 서버

```json
{ "type": "READ_MESSAGE", "payload": { "channelId": 1, "messageId": 864691128455135232 } }
```

### 서버 → 클라이언트

```json
{
  "type": "READ_EVENT",
  "payload": {
    "channelId": 1,
    "userId": "uuid-of-reader",
    "lastReadMessageId": 864691128455135232
  }
}
```

`userId`는 실제로 읽은 사람의 UUID. 수신 대상(라우팅 키)이 아님에 주의.

---

## Kafka 토픽 구조

| 토픽 | 발행자 | 소비자 | 내용 |
|------|--------|--------|------|
| `read-relay` | connection-service | message-service | 읽음 이벤트 (userId, channelId, messageId) |
| `read-fanout` | message-service | fanout-delivery-service | 읽음 이벤트 + 수신자 목록 |

- 파티션 키: `channelId` → 동일 채널 읽음 이벤트 순서 보장
- `read-relay`: concurrency 3, 파티션 3

---

## Redis 키 구조

| 키 패턴 | 타입 | 용도 |
|---------|------|------|
| `read:{channelId}:{userId}` | String | lastReadMessageId 캐시 |

TTL 없음. 채널 탈퇴 이벤트(`removeChannelMember`) 시 삭제 예정.

---

## 프론트엔드 상태 관리

### Zustand store (`webSocketStore.ts`)

```typescript
readState: Record<channelId, Record<userId, lastReadMessageId>>
```

| 액션 | 호출 시점 | 동작 |
|------|----------|------|
| `setReadState(channelId, state)` | 채팅방 진입 시 REST API 응답 | 전체 초기 상태 세팅 |
| `applyReadEvent(event)` | WebSocket READ_EVENT 수신 | 특정 유저의 lastReadMessageId 갱신 |

### 초기 로드 (`useInitialReadState`)

```
GET /api/channels/{channelId}/members/read-state
→ { "uuid-A": 864691128455135232, "uuid-B": 0 }
→ setReadState(channelId, response)
```

---

## 읽은 사람 / 안 읽은 사람 계산 방식

추가 API 요청 없이 **브라우저의 readState 맵만으로** 계산한다.

```
메시지 M (messageId = X, senderId = A) 기준:

읽은 사람:
  - 발신자(A): 항상 포함 (보낸 사람은 당연히 읽음)
  - 나머지 멤버: readState[userId] >= X 인 경우

안 읽은 사람:
  - 발신자(A): 제외
  - 나머지 멤버: readState[userId] < X 인 경우
```

```typescript
// 미읽음 수 계산 (메시지 옆 숫자)
function getUnreadCount(msg: DisplayMessage): number {
  const entries = Object.entries(readState).filter(([uid]) => uid !== msg.senderId);
  return entries.filter(([, lastReadId]) => BigInt(lastReadId) < BigInt(msg.messageId)).length;
}
```

BigInt 비교를 사용하는 이유: Snowflake ID가 JavaScript `Number.MAX_SAFE_INTEGER`(2^53 - 1) 범위 내에
있더라도, 명시적 BigInt 비교로 정밀도 손실 가능성을 원천 차단.
