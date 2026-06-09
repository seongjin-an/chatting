import { create } from "zustand";

export interface ContentMessage {
  messageId: string;
  channelId: number;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: number;
}

export interface ReadEvent {
  channelId: number;
  userId: string;       // 읽은 사람
  lastReadMessageId: string;
}

interface WebSocketStore {
  connected: boolean;
  messages: Record<string, ContentMessage[]>;
  // channelId → { userId → lastReadMessageId }
  readState: Record<string, Record<string, string>>;
  reconnectCount: number;

  setConnected: (connected: boolean) => void;
  addMessage: (message: ContentMessage) => void;
  applyReadEvent: (event: ReadEvent) => void;
  setReadState: (channelId: string, state: Record<string, string | null>) => void;
  handleInbound: (envelope: { type: string; payload: unknown }) => void;
  onReconnect: () => void;
}

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  connected: false,
  messages: {},
  readState: {},
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
    } else if (type === "READ_EVENT") {
      get().applyReadEvent(payload as ReadEvent);
    }
  },

  onReconnect: () =>
    set((s) => ({ reconnectCount: s.reconnectCount + 1 })),
}));
