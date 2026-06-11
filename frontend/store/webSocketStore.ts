import { create } from "zustand";

export interface ContentMessage {
  messageId: string;
  channelId: number;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: number;
  clientMessageId?: string;
}

export interface ReadEvent {
  channelId: number;
  userId: string;       // 읽은 사람
  lastReadMessageId: string;
}

interface WebSocketStore {
  connected: boolean;
  messages: Record<string, ContentMessage[]>;
  readState: Record<string, Record<string, string>>;
  reconnectCount: number;
  unreadCounts: Record<string, number>;
  activeChannelId: string | null;
  // 이번 세션에서 로컬 clearUnread를 호출한 채널 집합
  // setUnreadCounts(서버값)가 이 채널들을 0으로 다시 덮어쓰지 않도록 보호
  clearedChannels: Set<string>;

  setConnected: (connected: boolean) => void;
  addMessage: (message: ContentMessage) => void;
  applyReadEvent: (event: ReadEvent) => void;
  setReadState: (channelId: string, state: Record<string, string | null>) => void;
  handleInbound: (envelope: { type: string; payload: unknown }) => void;
  onReconnect: () => void;
  setUnreadCounts: (counts: Record<string, number>) => void;
  incrementUnread: (channelId: string) => void;
  clearUnread: (channelId: string) => void;
  setActiveChannel: (channelId: string | null) => void;
}

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  connected: false,
  messages: {},
  readState: {},
  reconnectCount: 0,
  unreadCounts: {},
  activeChannelId: null,
  clearedChannels: new Set<string>(),

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

  applyReadEvent: (event) => {
    const channelKey = String(event.channelId);
    const prev = get().readState[channelKey] ?? {};
    set({
      readState: {
        ...get().readState,
        [channelKey]: { ...prev, [event.userId]: event.lastReadMessageId },
      },
    });
  },

  setReadState: (channelId, state) => {
    const normalized = Object.fromEntries(
      Object.entries(state).map(([uid, mid]) => [uid, mid ?? "0"])
    ) as Record<string, string>;
    set({
      readState: { ...get().readState, [channelId]: normalized },
    });
  },

  handleInbound: (envelope) => {
    const { type, payload } = envelope;
    if (type === "CONTENT_MESSAGE") {
      get().addMessage(payload as ContentMessage);
      // 현재 열려 있는 채팅방이 아닌 채널의 메시지 → 미읽음 카운터 증가
      const channelKey = String((payload as ContentMessage).channelId);
      if (channelKey !== get().activeChannelId) {
        get().incrementUnread(channelKey);
      }
    } else if (type === "READ_EVENT") {
      get().applyReadEvent(payload as ReadEvent);
    }
  },

  onReconnect: () =>
    set((s) => ({
      reconnectCount: s.reconnectCount + 1,
      // 재연결 시에는 서버 기준으로 완전 동기화 — 로컬 cleared 상태 초기화
      clearedChannels: new Set<string>(),
    })),

  // 서버에서 받은 값으로 동기화
  // 이미 로컬에서 읽음 처리한(clearUnread 호출) 채널은 서버 stale 값으로 덮어쓰지 않음
  setUnreadCounts: (counts) =>
    set((s) => {
      const merged: Record<string, number> = {};
      Object.entries(counts).forEach(([id, count]) => {
        merged[id] = s.clearedChannels.has(id) ? 0 : count;
      });
      return { unreadCounts: merged };
    }),

  incrementUnread: (channelId) =>
    set((s) => ({
      unreadCounts: {
        ...s.unreadCounts,
        [channelId]: (s.unreadCounts[channelId] ?? 0) + 1,
      },
    })),

  clearUnread: (channelId) =>
    set((s) => ({
      unreadCounts: { ...s.unreadCounts, [channelId]: 0 },
      clearedChannels: new Set([...s.clearedChannels, channelId]),
    })),

  setActiveChannel: (channelId) => {
    set({ activeChannelId: channelId });
    if (channelId) get().clearUnread(channelId);
  },
}));
