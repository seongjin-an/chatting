import { create } from "zustand";

export interface ContentMessage {
  messageId: number;
  channelId: number;
  senderId: string;
  senderName: string;
  content: string;
  seq: number;
  createdAt: number;
}

// 갭 감지 후 강제 플러시까지 대기 시간
const GAP_FLUSH_TIMEOUT_MS = 1500;

// 타이머는 Zustand 상태 밖에서 관리 (non-serializable)
const gapTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface WebSocketStore {
  connected: boolean;
  // channelId → 확정 전달된 메시지 목록
  messages: Record<string, ContentMessage[]>;
  // channelId → 재정렬 대기 버퍼 (seq → message)
  buffer: Record<string, Map<number, ContentMessage>>;
  // channelId → 다음 기대 seq (undefined = 아직 첫 메시지 미수신)
  nextExpectedSeq: Record<string, number>;
  // channelId → 갭 발생 횟수. 컴포넌트가 이 값을 감지해 REST 재요청 트리거
  refetchTriggers: Record<string, number>;

  setConnected: (connected: boolean) => void;
  addMessage: (message: ContentMessage) => void;
  /** @internal 버퍼 플러시. force=true 면 갭을 건너뛰고 강제 전달 */
  _flush: (channelKey: string, force: boolean) => void;
}

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  connected: false,
  messages: {},
  buffer: {},
  nextExpectedSeq: {},
  refetchTriggers: {},

  setConnected: (connected) => set({ connected }),

  addMessage: (message) => {
    const channelKey = String(message.channelId);
    const state = get();

    // 현재 기대하는 seq — 첫 메시지 수신 시 해당 seq로 초기화
    const expectedSeq = state.nextExpectedSeq[channelKey] ?? message.seq;

    // 이미 전달 완료된 seq 는 중복이므로 무시
    if (message.seq < expectedSeq) return;

    const buffer = state.buffer[channelKey] ?? new Map<number, ContentMessage>();
    buffer.set(message.seq, message);

    set({
      buffer: { ...state.buffer, [channelKey]: buffer },
      nextExpectedSeq: { ...state.nextExpectedSeq, [channelKey]: expectedSeq },
    });

    // 연속 seq 즉시 플러시 시도
    get()._flush(channelKey, false);

    // 플러시 후 버퍼에 잔류 메시지가 있으면 갭 타이머 설정 (이미 있으면 리셋)
    const remainingBuffer = get().buffer[channelKey];
    if (remainingBuffer && remainingBuffer.size > 0) {
      const prev = gapTimers.get(channelKey);
      if (prev) clearTimeout(prev);
      gapTimers.set(
        channelKey,
        setTimeout(() => get()._flush(channelKey, true), GAP_FLUSH_TIMEOUT_MS)
      );
    }
  },

  _flush: (channelKey, force) => {
    const state = get();
    const buffer = state.buffer[channelKey];
    if (!buffer || buffer.size === 0) return;

    let expectedSeq = state.nextExpectedSeq[channelKey] ?? 0;
    const toDeliver: ContentMessage[] = [];

    // 연속된 seq 를 버퍼에서 꺼내 전달 목록에 추가
    while (buffer.has(expectedSeq)) {
      toDeliver.push(buffer.get(expectedSeq)!);
      buffer.delete(expectedSeq);
      expectedSeq++;
    }

    // 강제 플러시: 갭을 건너뛰고 버퍼에 남은 메시지를 seq 순으로 모두 전달
    if (force && toDeliver.length === 0 && buffer.size > 0) {
      const sorted = [...buffer.values()].sort((a, b) => a.seq - b.seq);
      toDeliver.push(...sorted);
      expectedSeq = sorted[sorted.length - 1].seq + 1;
      buffer.clear();
      // 갭 발생 → refetchTriggers 증가 → 컴포넌트가 감지해 REST 재요청
      const prev = state.refetchTriggers[channelKey] ?? 0;
      set({ refetchTriggers: { ...state.refetchTriggers, [channelKey]: prev + 1 } });
      console.warn(
        `[WS] seq gap on channel ${channelKey} — triggering REST refetch`
      );
    }

    if (toDeliver.length === 0) return;

    // 타이머 정리
    /*
      전달할 게 생겼다는 건 갭이 해소됐거나 강제 플러시로 처리됐다는 의미입니다. 타이머가 더 이상 필요 없으니 정리합니다.
      타이머가 만료되서 force=true로 들어온 경우:
      → toDeliver에 뭔가 있음 (강제 플러시)
      → gapTimers에서 이 채널 타이머 삭제

      seq=3이 도착해서 갭이 해소된 경우:
      → toDeliver에 [msg3, msg4, msg5] 있음
      → gapTimers에 있던 타이머 취소 + 삭제
        (1.5초 기다릴 필요 없어짐)
     */
    const timer = gapTimers.get(channelKey);
    if (timer) {
      clearTimeout(timer);
      gapTimers.delete(channelKey);
    }

    const current = state.messages[channelKey] ?? [];
    // 기존 메시지와 합산 후 seq 순 정렬 + 중복 제거
    const merged = [...current, ...toDeliver]
      .sort((a, b) => a.seq - b.seq)
      .filter((m, i, arr) => i === 0 || arr[i - 1].seq !== m.seq);

    set({
      messages: { ...state.messages, [channelKey]: merged },
      buffer: { ...state.buffer, [channelKey]: buffer },
      nextExpectedSeq: { ...state.nextExpectedSeq, [channelKey]: expectedSeq },
    });
  },
}));
