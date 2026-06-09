# Chat MSA

실시간 채팅 시스템을 MSA(Microservices Architecture)로 구현한 프로젝트입니다.  
Spring Boot 기반 백엔드 서비스들과 Next.js 프론트엔드로 구성됩니다.

---

## 목차
- 시스템 아키텍처 다이어그램 — 서비스 간 관계, 포트, 역할
- 메시지 흐름 — WebSocket 수신부터 DB 저장, 다시 브라우저 전달까지 11단계
- 모듈 구성표 — 포트, 역할 한눈에
- 기술 스택 — Backend / Frontend / Infra 분리
- 인증 흐름 — JWT 발급 → 게이트웨이 검증 → 헤더 주입
- Snowflake ID — 분산 메시지 ID 생성 전략
- Transactional Outbox 패턴 — 메시지 저장과 Kafka 발행의 원자성 보장
- 읽음 확인 (Read Receipt) — 클라이언트 주도 읽음 처리 설계
- Redis 키 구조 / Kafka 토픽 구조 — 설계 의도까지
- DB 스키마 — 복합키 설계 이유 포함
- 프로젝트 디렉토리 구조
- 실행 방법 — start/stop/restart/logs/build 스크립트 사용법
- API 명세 — REST + WebSocket 메시지 포맷
- 환경 변수 목록


## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                │
│                   (Next.js · :3000)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP / WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway  :8080                         │
│          JWT 검증 · 라우팅 · X-User-* 헤더 주입               │
│          (Spring Cloud Gateway · Reactive/Netty)                │
└──────┬───────────────────────────────┬───────────────┬──────────┘
       │ /api/auth/**                  │ /api/channels/** │ /ws/**
       ▼                               ▼                ▼
┌────────────┐         ┌──────────────────┐  ┌────────────────────┐
│user-service│         │  message-service  │  │ connection-service │
│   :8081    │         │     :8083         │  │      :8082         │
│            │         │                   │  │                    │
│ - 회원가입 │         │ - 채널 CRUD       │  │ - WebSocket 핸들러 │
│ - 로그인   │         │ - 멤버 관리       │  │ - 세션 레지스트리  │
│ - JWT 발급 │         │ - Snowflake ID 발급│  │ - Kafka 발행       │
│ - 토큰갱신 │         │ - 메시지 저장     │  │ - Kafka 소비       │
│ - Redis    │         │ - 메시지 조회     │  │ - Redis 연결정보   │
│   블랙리스트│         │ - Kafka 소비      │  │   저장/조회        │
└────────────┘         │ - Outbox 기록     │  │ - 읽음 이벤트 수신 │
                       │ - 읽음 상태 관리  │  └────────┬───────────┘
                       └────────┬──────────┘           │
                                │ binlog CDC            │
                                ▼                       │
                  ┌─────────────────────────┐           │
                  │  Kafka Connect  :28083   │           │
                  │  (Debezium · outbox CDC) │           │
                  └────────────┬────────────┘           │
                               │ message-fanout         │
                               ▼                        │
                  ┌─────────────────────────┐           │
                  │  fanout-delivery-service │           │
                  │         :8084            │           │
                  │                          │           │
                  │ - Outbox 이벤트 소비     │           │
                  │ - 읽음 이벤트 소비       │           │
                  │ - Redis 연결 라우팅      │           │
                  │ - 인스턴스별 Kafka 발행  │           │
                  └─────────┬───────────────┘           │
                            │                           │
                ┌───────────┴──┐            ┌───────────┴──┐
                │    Kafka     │            │    Redis      │
                │   :9092      │◄───────────►    :6379      │
                │ (KRaft 모드) │            │               │
                └──────────────┘            └───────────────┘
                            │
                     ┌──────┴──────┐
                     │    MySQL    │
                     │   :23306    │
                     │  utf8mb4    │
                     └─────────────┘

서비스 디스커버리: Eureka Server :8761
```

---

## 메시지 흐름

```
Browser
  │  1. WebSocket 메시지 전송 (type: SEND_MESSAGE)
  ▼
connection-service
  │  2. Kafka 발행 → [message-relay] topic
  │     payload: ContentMessageRequest { senderId, senderName, channelId, content, instanceId }
  ▼
message-service  (Kafka consumer)
  │  3. Snowflake ID 발급 (timestamp 48bit + workerId 5bit + seq 11bit)
  │  4. MySQL 저장 — message + outbox 같은 트랜잭션으로 원자적 기록
  │     message PK: (channelId, messageId) 복합키
  │     outbox: destinationTopic=message-fanout, payload에 recipientIds 포함
  ▼
Debezium (Kafka Connect · binlog CDC)
  │  5. outbox 테이블 INSERT 감지 → [message-fanout] 토픽 발행
  ▼
fanout-delivery-service  (Kafka consumer)
  │  6. 페이로드의 recipientIds 순회 → Redis 조회
  │     ws:user:{userId}         → connectionKey Set
  │     ws:connection:{key}      → ConnectionInfo JSON (instanceId 포함)
  │  7. stale connectionKey 자동 제거 (TTL 만료된 항목)
  │  8. 인스턴스별 그루핑 후 Kafka 발행
  │     → [connection-instance-{instanceId}] topic (인스턴스별)
  ▼
connection-service  (Kafka consumer, 자신의 instanceId 토픽만 소비)
  │  9. WebSocket 세션 레지스트리에서 userId로 세션 조회
  │  10. TextMessage 전송 (ContentMessage JSON)
  ▼
Browser
  11. 메시지 수신 → Zustand 스토어 업데이트 → UI 렌더링
```

---

## 모듈 구성

| 모듈 | 포트 | 역할 |
|------|------|------|
| `eureka-server` | 8761 | 서비스 디스커버리 (Netflix Eureka) |
| `api-gateway` | 8080 | 라우팅, JWT 인증, 헤더 주입 |
| `user-service` | 8081 | 회원가입/로그인/JWT 발급, Spring Security |
| `connection-service` | 8082 | WebSocket 연결 관리, Kafka 브릿지 |
| `message-service` | 8083 | 채널/메시지 CRUD, Snowflake ID 발급, Outbox 기록 |
| `fanout-delivery-service` | 8084 | Outbox 소비 → 채널 멤버 조회 → 인스턴스별 Kafka 라우팅 |
| `common` | — | 공용 DTO, 유틸, 상수 (java-library) |
| `frontend` | 3000 | Next.js 클라이언트 |

---

## 기술 스택

### Backend

| 분류 | 기술 |
|------|------|
| 언어 | Java 21 |
| 프레임워크 | Spring Boot 3.3.5 |
| 서비스 디스커버리 | Spring Cloud Netflix Eureka 2023.0.3 |
| API Gateway | Spring Cloud Gateway (Reactive / Netty) |
| WebSocket | Spring WebSocket (Servlet, STOMP 미사용) |
| 메시지 브로커 | Spring Kafka (Apache Kafka 7.6.1 · KRaft 모드) |
| ORM | Spring Data JPA + Hibernate |
| 인증 | Spring Security + JWT (jjwt 0.12.6) |
| 캐시/세션 | Spring Data Redis 7 |
| DB | MySQL 8.0.33 (utf8mb4) |
| 빌드 | Gradle 8 (Kotlin DSL) · Multi-module |
| 유틸 | Lombok 1.18.36 |

### Frontend

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 16.2.6 (App Router) |
| 언어 | TypeScript 5 |
| UI | Tailwind CSS 4 |
| 상태관리 | Zustand 5 (WebSocket 실시간), TanStack Query 5 (REST) |
| HTTP | Axios 1 |
| 인증 | js-cookie (JWT 쿠키 저장) |
| 실시간 | WebSocket (Native Browser API) |

### Infrastructure (Docker Compose)

| 서비스 | 이미지 | 포트 | 용도 |
|--------|--------|------|------|
| MySQL | mysql:8.0.33 | 23306 | 사용자/채널/메시지 영속 저장 |
| Kafka | confluentinc/cp-kafka:7.6.1 | 9092 | 메시지 릴레이 (KRaft 모드) |
| Kafka Connect | quay.io/debezium/connect:3.1 | 28083 | Outbox CDC (Debezium MySQL 커넥터) |
| Redis | redis:7 | 6379 | JWT 블랙리스트, WebSocket 연결 라우팅 |
| Kafka UI | provectuslabs/kafka-ui | 9090 | Kafka 모니터링 |
| RedisInsight | redis/redisinsight:2.64.1 | 5540 | Redis 모니터링 |

---

## 인증 흐름

```
1. 로그인 → user-service → JWT(AccessToken + RefreshToken) 발급
   - AccessToken claim: sub=userId, role, name
   - 유효기간: AccessToken 1시간 / RefreshToken 7일

2. API 요청 → Authorization: Bearer {token} 헤더 or ?token= 쿼리 파라미터
   (브라우저 WebSocket은 커스텀 헤더 불가 → 쿼리 파라미터 폴백)

3. API Gateway JWT 필터
   - 서명 검증 + 만료 확인
   - Redis 블랙리스트(BL:{jti}) 조회 → 로그아웃된 토큰 차단
   - 검증 통과 시 다운스트림에 헤더 주입:
     X-User-Id:   {userId UUID}
     X-User-Role: {role}
     X-User-Name: {URL-encoded name}   ← HTTP 헤더 비ASCII 인코딩

4. 각 서비스는 X-User-* 헤더를 신뢰하여 사용 (JWT 직접 파싱 없음)
```

---

## Snowflake ID

메시지 ID는 Redis INCR 대신 **Snowflake ID**로 발급합니다.

```
비트 구성 (64bit):
  [ 48bit 타임스탬프 ] [ 5bit workerId ] [ 11bit sequence ]
  └─ ms 단위, Epoch: 2024-01-01 00:00:00 UTC
                           └─ 0~31 (최대 32 인스턴스)
                                           └─ ms당 최대 2,047개

장점:
  - 전역 단조 증가 → ORDER BY message_id = 시간 순서 보장
  - Redis 의존 제거 → 네트워크 RTT 없이 로컬 생성
  - 분산 환경 충돌 없음 (workerId로 인스턴스 구분)
```

---

## Transactional Outbox 패턴

메시지 저장과 Kafka 발행 사이의 원자성을 보장하기 위해 Outbox 패턴을 사용합니다.

```
문제: Kafka.send() 성공 ↔ MySQL 저장 실패 → 메시지 유실 또는 중복
해결:
  1. 채널 멤버 조회 후 recipientIds를 outbox 페이로드에 포함
  2. message + outbox 레코드를 같은 트랜잭션으로 MySQL에 기록
  3. Debezium (Kafka Connect)가 outbox 테이블 binlog INSERT 감지
  4. Kafka [message-fanout] 토픽으로 자동 라우팅 발행
  5. OutboxEventCleaner가 1일 경과 PROCESSED 이벤트 정리

Polling 방식(OutboxEventPoller)에서 CDC 방식으로 전환:
  - 폴링 지연(100ms) 제거 → binlog 기반 실시간 감지
  - message-service 부하 감소 (DB 폴링 루프 없음)
```

---

## 읽음 확인 (Read Receipt)

> 상세 설계는 [read-receipt.md](./read-receipt.md) 참조

### 핵심 원칙: 딜리버리 ≠ 읽음

WebSocket으로 메시지가 전달됐다고 읽은 것이 아니다.  
**브라우저가 채팅방 페이지에 마운트된 상태**일 때만 읽음으로 처리한다.

```
읽음 트리거:
  1. 채팅방 입장 → 히스토리 로드 완료 시 최신 messageId로 READ_MESSAGE 전송
  2. 채팅방에 있는 동안 → 새 메시지 수신 시 READ_MESSAGE 전송

뒤로가기로 채팅방 이탈 → 페이지 언마운트 → 신호 없음 → 읽음 처리 안 됨
```

### 읽음 흐름

```
Browser (채팅방 마운트됨)
  │  READ_MESSAGE { channelId, messageId }
  ▼
connection-service
  │  Kafka [read-relay]
  ▼
message-service
  │  DB: channel_member.last_read_message_id UPDATE
  │  Redis: read:{channelId}:{userId} SET
  │  Kafka [read-fanout]
  ▼
fanout-delivery-service
  │  채널 멤버 → 인스턴스별 라우팅
  ▼
connection-service
  │  WebSocket push: READ_EVENT { channelId, userId(읽은사람), lastReadMessageId }
  ▼
Browser (채널 멤버 전체)
  → readState 갱신 → 읽음 수 실시간 업데이트
```

### 읽음 상태 계산

`channel_member.last_read_message_id` 단일 값으로 모든 메시지의 읽음 여부를 판단한다.

```
메시지 M (messageId = X) 기준:
  last_read_message_id >= X → 읽음
  last_read_message_id <  X → 안읽음
```

Snowflake ID의 단조증가 특성 덕분에 High-Watermark 방식이 가능하다.

---

## Redis 키 구조

| 키 패턴 | 타입 | 용도 |
|---------|------|------|
| `BL:{jti}` | String | JWT 블랙리스트 (로그아웃) |
| `ws:user:{userId}` | Set | 사용자의 connectionKey 목록 |
| `ws:connection:{connectionKey}` | String (JSON) | 연결 정보 (instanceId, userId 등) |
| `read:{channelId}:{userId}` | String | lastReadMessageId 캐시 |

> 메시지 ID는 과거 Redis INCR(`channel:seq:{channelId}`)에서 **Snowflake ID**로 교체되었습니다.

---

## Kafka 토픽 구조

| 토픽 | 발행자 | 소비자 | 내용 |
|------|--------|--------|------|
| `message-relay` | connection-service | message-service | 클라이언트 발신 메시지 |
| `message-fanout` | Debezium (Kafka Connect) | fanout-delivery-service | Outbox 이벤트 + 수신자 목록 |
| `read-relay` | connection-service | message-service | 읽음 이벤트 (userId, channelId, messageId) |
| `read-fanout` | message-service | fanout-delivery-service | 읽음 이벤트 + 수신자 목록 |
| `connection-instance-{instanceId}` | fanout-delivery-service | connection-service (인스턴스별) | 콘텐츠 메시지 + 읽음 이벤트 → WS 전달 |

- 파티션: 3, 레플리카: 1 (개발 환경)
- `message-relay` 파티션 키: `channelId` → 동일 채널 메시지 순서 보장
- `message-fanout` 파티션 키: `channelId`
- `read-relay` 파티션 키: `channelId`

---

## 데이터베이스 스키마

### chatting DB (user-service)

- **users**: id(UUID PK), email, name, phone, password, role, created_at

### chat_message DB (message-service)

- **channel**: channel_id(PK), title, created_at
- **channel_member**: channel_id + user_id (복합 PK), joined_at, last_read_message_id (읽음 High-Watermark)
- **message**: channel_id + message_id (복합 자연키 PK) — InnoDB 클러스터드 인덱스 최적화
- **outbox**: event_id(UUID PK), aggregate_type, aggregate_id, event_type, payload(TEXT), destination_topic, partition_key, status(PENDING/IN_PROGRESS/PROCESSED/FAILED), retry_count, trace_id, created_at, processed_at

> `message` 테이블 PK를 `(channel_id, message_id)` 복합키로 설계하여  
> `WHERE channel_id = ? ORDER BY message_id` 쿼리가 인덱스 스캔만으로 처리됨  
> `message_id`는 Snowflake ID(시간순 단조 증가)이므로 정렬 순서가 자연스럽게 보장됨

---

## 프로젝트 구조

```
chat-msa/
├── build.gradle.kts          # 루트 멀티모듈 Gradle 설정
├── settings.gradle.kts
├── common/                   # 공용 라이브러리 (java-library)
│   └── src/main/java/com/chat/common/
│       ├── Constant.java
│       ├── ContentMessage.java
│       ├── JsonUtil.java
│       ├── KeyPrefix.java
│       └── UserId.java
├── eureka-server/
├── api-gateway/
├── user-service/
├── connection-service/
├── message-service/
│   └── src/main/java/com/chat/message/
│       ├── util/
│       │   └── SnowflakeIdGenerator.java  # 분산 ID 생성기
│       └── outbox/                        # Transactional Outbox
│           ├── OutboxEventEntity.java
│           ├── OutboxEventWriter.java     # message 저장 트랜잭션 내 outbox 기록
│           ├── OutboxEventPoller.java     # (비활성화) 구 폴링 방식 — Debezium CDC로 대체
│           └── OutboxEventCleaner.java    # 1일 후 processed 이벤트 정리
├── fanout-delivery-service/               # 신규
├── frontend/                 # Next.js App Router
│   ├── app/
│   │   ├── login/
│   │   ├── signup/
│   │   ├── dashboard/
│   │   └── rooms/
│   │       ├── page.tsx      # 채널 목록
│   │       ├── create/
│   │       └── [roomId]/     # 채팅방
│   ├── store/
│   │   ├── authStore.ts      # Zustand (인증)
│   │   └── webSocketStore.ts # Zustand (실시간 메시지)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useChannel.ts     # TanStack Query
│   │   └── useWebSocket.ts
│   └── lib/
│       ├── api.ts
│       ├── axios.ts
│       └── webSocket.ts
├── infra/
│   ├── compose.yml              # Docker Compose
│   ├── register-debezium.sh     # Debezium 커넥터 등록 스크립트 (start.sh에서 호출)
│   └── mysql/
│       └── init.sql             # DB 초기화 (utf8mb4)
└── scripts/
    ├── start.sh              # 전체 기동
    ├── stop.sh               # 전체 종료
    ├── restart.sh            # 단일 서비스 재기동
    ├── status.sh             # 상태 확인
    ├── logs.sh               # 로그 조회
    └── build.sh              # 빌드
```

---

## 실행 방법

### 사전 요구사항

- Java 21 (`/usr/libexec/java_home -v 21`)
- Docker Desktop
- Node.js 18+

### 전체 기동

```bash
./scripts/start.sh
```

인프라(Docker) → 빌드 → Eureka → Gateway → 서비스들 → 프론트엔드 순으로 자동 기동됩니다.

### 개별 서비스 재기동

```bash
./scripts/restart.sh <service-name>           # 빌드 + 재기동
./scripts/restart.sh <service-name> --skip-build  # 빌드 생략
```

서비스 이름: `eureka-server` · `api-gateway` · `user-service` · `connection-service` · `message-service` · `fanout-delivery-service` · `frontend`

### 전체 종료

```bash
./scripts/stop.sh              # 서비스만 종료 (Docker 유지)
STOP_INFRA=true ./scripts/stop.sh  # Docker까지 종료
```

### 상태 확인 / 로그

```bash
./scripts/status.sh            # 전체 서비스 UP/DOWN 확인
./scripts/logs.sh <service>    # 실시간 로그 (tail -f)
./scripts/logs.sh <service> 200  # 최근 N줄
```

### 빌드만 실행

```bash
./scripts/build.sh                        # 전체 빌드
./scripts/build.sh user-service message-service  # 특정 모듈만
```

---

## 접속 URL

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | http://localhost:3000 |
| API Gateway | http://localhost:8080 |
| Eureka Dashboard | http://localhost:8761 |
| Kafka UI | http://localhost:9090 |
| RedisInsight | http://localhost:5540 |

---

## 주요 API

### 인증 (`/api/auth`)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/login` | 로그인 (JWT 발급) |
| POST | `/api/auth/logout` | 로그아웃 (블랙리스트 등록) |
| POST | `/api/auth/refresh` | 토큰 갱신 |
| GET | `/api/auth/me` | 내 정보 조회 |

### 채널 (`/api/channels`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/channels` | 전체 채널 목록 (페이징) |
| GET | `/api/channels/me` | 내 채널 목록 |
| POST | `/api/channels` | 채널 생성 |
| POST | `/api/channels/{id}/members` | 채널 참여 |
| DELETE | `/api/channels/{id}/members/me` | 채널 탈퇴 |
| GET | `/api/channels/{id}/messages` | 메시지 히스토리 (커서 기반) |

### 읽음 상태 (`/api/channels`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/channels/{id}/members/read-state` | 채널 멤버별 lastReadMessageId 맵 반환 |

### WebSocket (`ws://localhost:8080/ws?token={JWT}`)

**클라이언트 → 서버**
```json
{ "type": "SEND_MESSAGE", "payload": { "channelId": 1, "content": "안녕" } }
{ "type": "HEARTBEAT",    "payload": {} }
{ "type": "READ_MESSAGE", "payload": { "channelId": 1, "messageId": 864691128455135232 } }
```

**서버 → 클라이언트**
```json
// 새 메시지
{ "type": "CONTENT_MESSAGE", "payload": {
    "messageId": "864691128455135232", "channelId": 1,
    "senderId": "uuid", "senderName": "이름",
    "content": "안녕", "createdAt": 1748995200000
}}

// 읽음 이벤트
{ "type": "READ_EVENT", "payload": {
    "channelId": 1,
    "userId": "uuid-of-reader",
    "lastReadMessageId": 864691128455135232
}}

---

## 환경 변수

각 서비스는 환경 변수로 설정을 오버라이드할 수 있습니다. (기본값: 로컬 개발 환경)

| 변수 | 기본값 | 적용 서비스 |
|------|--------|------------|
| `SERVER_PORT` | 서비스별 기본 포트 | 전체 |
| `EUREKA_URL` | `http://localhost:8761/eureka/` | 전체 |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | connection, message, fanout |
| `REDIS_HOST` | `localhost` | 전체 |
| `REDIS_PORT` | `6379` | 전체 |
| `DB_URL` | `jdbc:mysql://localhost:23306/...` | user, message |
| `DB_USERNAME` | `dev_user` | user, message |
| `DB_PASSWORD` | `dev_password` | user, message |
| `JWT_SECRET` | 개발용 고정값 | api-gateway, user |
| `JWT_ACCESS_EXPIRATION` | `3600000` (1시간) | user |
| `JWT_REFRESH_EXPIRATION` | `604800000` (7일) | user |
| `CHATTING_SNOWFLAKE_WORKER_ID` | `0` | message |
