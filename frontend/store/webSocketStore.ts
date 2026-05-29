/**
 * 연결 상태 + 룸별 메시지 관리
 */

import { create } from "zustand";

export interface ContentMessage {
  messageId: number;
  roomId: number;
  senderId: string;
  senderName: string;
  content: string;
  seq: number;
  createdAt: number;
}

interface WebSocketStore {
  connected: boolean;
  // roomId → 메시지 목록 (seq 순 정렬 유지)
  messages: Record<string, ContentMessage[]>;
  // roomId → 마지막으로 처리한 seq
  lastSeq: Record<string, number>;

  setConnected: (connected: boolean) => void;
  addMessage: (message: ContentMessage) => void;
  getMessages: (roomId: string) => ContentMessage[];
}

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  connected: false,
  messages: {},
  lastSeq: {},

  setConnected: (connected) => set({ connected }),

  addMessage: (message) => {
    const roomKey = String(message.roomId);
    const { messages, lastSeq } = get();
    const roomMessages = messages[roomKey] ?? [];
    const prevSeq = lastSeq[roomKey] ?? 0;

    // 중복 메시지 무시
    if (message.seq <= prevSeq) return;

    // seq 순서로 삽입 (대부분 마지막에 추가됨)
    const inserted = [...roomMessages, message].sort((a, b) => a.seq - b.seq);

    set({
      messages: { ...messages, [roomKey]: inserted },
      lastSeq: { ...lastSeq, [roomKey]: message.seq },
    });
  },

  getMessages: (roomId) => get().messages[roomId] ?? [],
}));
