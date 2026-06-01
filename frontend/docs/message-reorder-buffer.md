# 메시지 재정렬 버퍼 (Message Reorder Buffer)

> 관련 파일: `store/webSocketStore.ts`

WebSocket 메시지는 네트워크 상황에 따라 seq 순서가 뒤바뀐 채로 도착할 수 있습니다.  
단순히 도착 순서대로 렌더링하면 채팅이 뒤섞이고, 늦게 도착한 메시지는 영구 드롭됩니다.  
이를 해결하기 위해 **재정렬 버퍼**를 구현합니다.

---

## 상태 구조

```typescript
messages: Record<string, ContentMessage[]>;
buffer:   Record<string, Map<number, ContentMessage>>;
nextExpectedSeq: Record<string, number>;
```

세 개의 "장부"를 채널별로 따로 관리합니다.

| 장부 | 역할 | 예시 |
|------|------|------|
| `messages` | 순서 확정돼서 UI에 보여줄 메시지들 | `{ "1": [seq1, seq2, seq3] }` |
| `buffer` | 순서 확정 못 한 대기실 (seq로 O(1) 조회) | `{ "1": Map{3→msg3} }` |
| `nextExpectedSeq` | 다음에 받아야 할 seq 번호 | `{ "1": 2 }` → "2번이 와야 함" |

`buffer`에 `Map<number, ContentMessage>`를 쓰는 이유: 배열은 `find(m => m.seq === 3)` O(n)이지만 Map은 `buffer.has(3)` O(1)입니다.

---

## `addMessage` — 메시지 수신 시 처리

### 1. 채널 키 변환

```typescript
const channelKey = String(message.channelId);  // "1"
```

`message.channelId`는 숫자인데 `messages` 키는 문자열이라 변환합니다.

---

### 2. 첫 메시지 처리 (nextExpectedSeq 초기화)

```typescript
const nextSeq = state.nextExpectedSeq[channelKey] ?? message.seq;
```

`nextExpectedSeq["1"]`가 없으면(= 이 채널에서 아직 아무 메시지도 안 받았으면) 지금 도착한 seq를 시작점으로 삼습니다.

예: 채널 입장 후 첫 메시지가 seq=5로 오면 → `nextSeq = 5`

0으로 초기화하지 않는 이유: 0으로 시작하면 seq 1~4는 전부 "이미 처리됨"으로 드롭됩니다.  
실제 첫 메시지 seq부터 받기 시작하는 게 맞습니다.

---

### 3. 중복 차단

```typescript
if (message.seq < nextSeq) return;
```

`nextSeq`보다 작다는 건 이미 전달 완료한 seq입니다.

예: `nextSeq=4`일 때 seq=2 도착 → 이미 UI에 있음 → 무시

---

### 4. 버퍼에 적재

```typescript
const buffer = state.buffer[channelKey] ?? new Map();
buffer.set(message.seq, message);
```

순서가 맞든 안 맞든 일단 버퍼에 넣습니다.

예: seq=3 도착 → `buffer = Map{ 3 → msg3 }`

---

### 5. 연속 플러시 시도

```typescript
get()._flush(channelKey, false);
```

버퍼에 넣은 직후 바로 연속 플러시를 시도합니다. `force=false`라 갭이 있으면 기다립니다.

---

### 6. 갭 감지 → 타이머 설정

```typescript
const remainingBuffer = get().buffer[channelKey];
if (remainingBuffer && remainingBuffer.size > 0) {
  const prev = gapTimers.get(channelKey);
  if (prev) clearTimeout(prev);
  gapTimers.set(
    channelKey,
    setTimeout(() => get()._flush(channelKey, true), GAP_FLUSH_TIMEOUT_MS)
  );
}
```

플러시 후 버퍼에 뭔가 남아있다 = 갭이 있다는 뜻입니다.

예: `nextSeq=2`인데 seq=3만 버퍼에 있음 → seq=2가 안 왔음 → 1.5초 타이머 시작

- **1.5초 안에 seq=2가 오면** → `addMessage`가 다시 호출되며 `clearTimeout`으로 타이머 취소
- **1.5초가 지나도 안 오면** → `_flush(channelKey, true)` 강제 실행 (갭 스킵)

타이머를 매번 `clearTimeout` 후 다시 세팅하는 이유:  
seq=3 도착(타이머 시작) → seq=5 도착 → 타이머를 리셋해서 "seq=4를 1.5초 더 기다림"처럼 동작합니다.

> **타이머를 Zustand 상태 밖에 두는 이유**  
> `setTimeout`의 반환값(`NodeJS.Timeout`)은 직렬화 불가 객체입니다.  
> Zustand 상태에 넣으면 devtools 직렬화 오류가 발생하므로 모듈 레벨 `Map`으로 관리합니다.

---

## `_flush` — 실제 전달 로직

### 연속 seq 꺼내기

```typescript
while (buffer.has(nextSeq)) {
  toDeliver.push(buffer.get(nextSeq)!);
  buffer.delete(nextSeq);
  nextSeq++;
}
```

`nextSeq`부터 버퍼에 연속으로 있는 것들을 순서대로 꺼냅니다.

예시 — 정상 케이스:
```
nextSeq=2, buffer = Map{ 2→msg2, 3→msg3, 5→msg5 }

while: has(2)? ✓ → toDeliver=[msg2], buffer={3,5}, nextSeq=3
while: has(3)? ✓ → toDeliver=[msg2,msg3], buffer={5}, nextSeq=4
while: has(4)? ✗ → 종료

→ msg2, msg3 전달. seq=5는 버퍼에 남음 (seq=4 기다리는 중)
```

---

### 강제 플러시 (갭 스킵)

```typescript
if (force && toDeliver.length === 0 && buffer.size > 0) {
  const sorted = [...buffer.values()].sort((a, b) => a.seq - b.seq);
  toDeliver.push(...sorted);
  nextSeq = sorted[sorted.length - 1].seq + 1;
  buffer.clear();
  console.warn(`[WS] seq gap detected ...`);
}
```

세 조건이 모두 참일 때만 실행됩니다.

| 조건 | 의미 |
|------|------|
| `force` | 타이머 만료로 호출된 케이스 |
| `toDeliver.length === 0` | 연속 플러시가 아무것도 못 꺼냄 = 갭이 있음 |
| `buffer.size > 0` | 그런데 버퍼엔 메시지가 있음 |

예시 — 갭 강제 스킵:
```
nextSeq=4, buffer = Map{ 6→msg6, 7→msg7 }  (seq=4, 5가 영영 안 옴)

1.5초 후 force=true 로 호출
→ while has(4)? ✗ → toDeliver=[]
→ force 분기 진입
→ sorted = [msg6, msg7]
→ toDeliver=[msg6, msg7], nextSeq=8
→ 경고 로그 출력 후 전달
```

---

### 중복 제거 병합

```typescript
const merged = [...current, ...toDeliver]
  .sort((a, b) => a.seq - b.seq)
  .filter((m, i, arr) => i === 0 || arr[i - 1].seq !== m.seq);
```

기존 `messages`와 새로 전달할 것들을 합칩니다.  
`.filter`가 중복 제거하는 방식: 정렬 후 이전 원소와 seq가 같으면 제거합니다.

```
[seq1, seq2, seq2, seq3].filter(...)
 i=0: 항상 통과           → seq1 ✓
 i=1: prev.seq(1) ≠ 2    → seq2 ✓
 i=2: prev.seq(2) = 2    → 제거 ✗
 i=3: prev.seq(2) ≠ 3    → seq3 ✓
결과: [seq1, seq2, seq3]
```

---

## 전체 시나리오

### 정상 케이스 (순서대로 도착)

```
seq1 도착 → buffer={1}, _flush → has(1)✓ → messages=[1], next=2, 버퍼 비어있음
seq2 도착 → buffer={2}, _flush → has(2)✓ → messages=[1,2], next=3
seq3 도착 → buffer={3}, _flush → has(3)✓ → messages=[1,2,3], next=4
```

### 역순 도착 케이스

```
seq3 도착 → buffer={3}, nextSeq=3(첫 메시지), _flush → has(3)✓ → messages=[3], next=4
seq1 도착 → seq(1) < nextSeq(4) → 중복 판단, 무시
seq2 도착 → seq(2) < nextSeq(4) → 중복 판단, 무시
```

> 이 케이스는 현재 구현의 한계입니다.  
> 첫 메시지 기준으로 `nextSeq`를 잡기 때문에 이전 seq들이 드롭됩니다.  
> 실제로는 Kafka 파티션 키가 `{channelId}-{senderId}`로 묶여 있어서  
> 같은 발신자의 메시지는 파티션 순서가 보장되고, 이런 역전 상황은 매우 드뭅니다.

### 갭 케이스 (seq 2 유실)

```
seq1 도착 → messages=[1], next=2
seq3 도착 → buffer={3}, _flush → has(2)?✗ → 버퍼 잔류 → 타이머 1.5초 시작
seq4 도착 → buffer={3,4}, _flush → has(2)?✗ → 타이머 리셋 (1.5초 재시작)

(1.5초 경과, seq2 미도착)
타이머 만료 → _flush(force=true) → sorted=[msg3,msg4] → messages=[1,3,4], next=5
              경고 로그: [WS] seq gap detected on channel 1, force-flushed 2 messages

seq2 도착 → seq(2) < nextSeq(5) → 무시 (이미 갭 스킵됨)
```

---

## 설계 결정 사항

| 결정 | 이유 |
|------|------|
| 타이머를 모듈 레벨 Map으로 관리 | Zustand 상태에 넣으면 devtools 직렬화 오류 발생 |
| 갭 대기 시간 1.5초 | 하트비트 주기(30s) 대비 충분히 짧고, 일시적 지연(수백 ms) 대비 충분히 긺 |
| 강제 플러시 시 경고 로그 | seq 유실은 서버/네트워크 이슈 신호이므로 추적 가능하게 남김 |
| 첫 메시지 seq를 시작점으로 | 0으로 초기화하면 히스토리 로드 전 수신 메시지가 전부 드롭됨 |
