import { create } from "zustand";

export interface ContentMessage {
  messageId: string;
  channelId: number;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: number;
}

interface WebSocketStore {
  connected: boolean;
  messages: Record<string, ContentMessage[]>;
  // 재연결 횟수 — 페이지에서 이 값을 구독해 REST 히스토리 재요청 트리거로 사용
  reconnectCount: number;
  setConnected: (connected: boolean) => void;
  addMessage: (message: ContentMessage) => void;
  onReconnect: () => void;
}

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  connected: false,
  messages: {},
  reconnectCount: 0,

  setConnected: (connected) => set({ connected }),

  addMessage: (message) => {
    const channelKey = String(message.channelId);
    const current = get().messages[channelKey] ?? [];
    if (current.some((m) => m.messageId === message.messageId)) return;
    set({
      messages: {
        ...get().messages,
        [channelKey]: [...current, message],
      },
    });
  },

  onReconnect: () =>
    set((s) => ({ reconnectCount: s.reconnectCount + 1 })),
}));
