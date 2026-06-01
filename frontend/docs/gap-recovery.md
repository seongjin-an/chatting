# 갭 복구 (Gap Recovery)

> 관련 파일: `store/webSocketStore.ts`, `app/rooms/[roomId]/page.tsx`

재정렬 버퍼([message-reorder-buffer.md](./message-reorder-buffer.md))가 1.5초를 기다려도 누락된 seq가 오지 않으면
강제 플러시로 해당 seq를 건너뜁니다.
이때 건너뛴 메시지는 영구 유실될 수 있으므로, REST API로 누락 구간을 재요청해 복구합니다.

---

## 설계 원칙

스토어와 TanStack Query를 직접 엮지 않습니다.

```
WebSocketStore          ChatRoomPage           TanStack Query
     │                       │                      │
     │  refetchTriggers 증가  │                      │
     │──────────────────────►│                      │
     │                       │  refetchHistory()    │
     │                       │─────────────────────►│
     │                       │                      │ REST 요청
     │                       │◄─────────────────────│
     │                       │  historyResult 갱신  │
     │                       │                      │
     │           useMemo: history + WS 머지          │
     │           갭 구간 자동으로 채워짐              │
```

스토어는 "갭이 발생했다"는 신호(숫자 카운터)만 올리고,
컴포넌트가 그 신호를 감지해 Query refetch를 직접 호출합니다.
의존성 방향이 단방향으로 유지됩니다.

---

## 구현

### 1. 스토어 — `refetchTriggers` 상태 추가

```typescript
// channelId → 갭 발생 횟수
refetchTriggers: Record<string, number>;
```

갭이 감지될 때마다 해당 채널의 카운터를 1씩 올립니다.
단순 boolean이 아닌 숫자를 쓰는 이유: 같은 값이면 `useEffect`가 재실행되지 않기 때문입니다.

```typescript
// _flush 내부 — 강제 플러시 분기
if (force && toDeliver.length === 0 && buffer.size > 0) {
  // ... 버퍼 강제 전달 ...

  const prev = state.refetchTriggers[channelKey] ?? 0;
  set({ refetchTriggers: { ...state.refetchTriggers, [channelKey]: prev + 1 } });

  console.warn(`[WS] seq gap on channel ${channelKey} — triggering REST refetch`);
}
```

### 2. 컴포넌트 — 트리거 감지 후 refetch

```typescript
const { data: historyResult, refetch: refetchHistory } = useChannelMessages(Number(channelId));
const refetchTrigger = useWebSocketStore((s) => s.refetchTriggers[channelId] ?? 0);

// refetchTrigger가 바뀔 때마다 REST 재요청
useEffect(() => {
  if (refetchTrigger > 0) refetchHistory();
}, [refetchTrigger]);
```

### 3. 머지 — 기존 useMemo가 자동으로 처리

```typescript
const allMessages = useMemo<DisplayMessage[]>(() => {
  const history = (historyResult?.messages ?? []).map(toDisplay);
  const realtime = wsMessages.map(toDisplay);

  const seqSet = new Set<number>();
  const merged: DisplayMessage[] = [];
  for (const msg of [...history, ...realtime]) {
    if (!seqSet.has(msg.seq)) {
      seqSet.add(msg.seq);
      merged.push(msg);
    }
  }
  return merged.sort((a, b) => a.seq - b.seq);
}, [historyResult, wsMessages]);
```

REST 응답(`historyResult`)이 갱신되면 `useMemo`가 재실행됩니다.
history에 누락됐던 seq가 포함돼 있으면 자동으로 채워지고,
이미 WS로 받은 seq는 `seqSet` 중복 제거로 걸러집니다.

---

## 전체 흐름 예시

```
[정상 구간]
seq=1 도착 → messages=[1], expectedSeq=2
seq=2 도착 → messages=[1,2], expectedSeq=3

[갭 발생]
seq=4 도착 → buffer={4}, 타이머 시작 (1.5초)
seq=5 도착 → buffer={4,5}, 타이머 리셋 (1.5초)

(1.5초 경과, seq=3 미도착)
→ _flush(force=true)
→ seq=4,5 강제 전달 → messages=[1,2,4,5]
→ refetchTriggers["1"] = 1  ← 신호 발생

[컴포넌트 감지]
→ refetchTrigger: 0 → 1 변화
→ refetchHistory() 호출
→ REST GET /api/channels/1/messages

[REST 응답]
historyResult.messages = [seq1, seq2, seq3, seq4, seq5]

[useMemo 재실행]
history = [seq1, seq2, seq3, seq4, seq5]
realtime = [seq4, seq5]              ← WS에서 이미 받은 것들
merged (중복 제거) = [seq1, seq2, seq3, seq4, seq5]  ← seq3 복구됨
```

---

## 동작 특성

| 상황 | 동작 |
|------|------|
| 갭 발생 즉시 | 이후 메시지(seq=4,5)는 강제 플러시로 즉시 표시 |
| REST 응답 전 | seq=3 자리가 비어있음 (일시적) |
| REST 응답 후 | seq=3 복구, 전체 순서 정렬 완료 |
| seq=3이 DB에도 없는 경우 | 복구 불가, 갭 유지 (서버 측 유실) |

---

## 설계 결정 사항

| 결정 | 이유 |
|------|------|
| boolean 대신 카운터 사용 | 동일 값이면 `useEffect` deps가 변화를 감지 못 함 |
| 스토어에서 직접 fetch 호출 안 함 | 스토어가 React/Query에 의존하면 테스트·재사용성 저하 |
| 강제 플러시 후 즉시 REST 요청 | 갭 자리를 비워두지 않고 최대한 빨리 채움 |
| 기존 머지 로직 재사용 | 별도 복구 로직 없이 `useMemo`의 중복 제거가 자동 처리 |
