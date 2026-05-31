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

interface WebSocketStore {
  connected: boolean;
  // channelId → 메시지 목록 (seq 순 정렬 유지)
  messages: Record<string, ContentMessage[]>;
  // channelId → 마지막으로 처리한 seq
  lastSeq: Record<string, number>;

  setConnected: (connected: boolean) => void;
  addMessage: (message: ContentMessage) => void;
}

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  connected: false,
  messages: {},
  lastSeq: {},

  setConnected: (connected) => set({ connected }),

  addMessage: (message) => {
    const channelKey = String(message.channelId);
    const { messages, lastSeq } = get();
    const channelMessages = messages[channelKey] ?? [];
    const prevSeq = lastSeq[channelKey] ?? 0;

    if (message.seq <= prevSeq) return;

    const inserted = [...channelMessages, message].sort((a, b) => a.seq - b.seq);

    set({
      messages: { ...messages, [channelKey]: inserted },
      lastSeq: { ...lastSeq, [channelKey]: message.seq },
    });
  },

}));
