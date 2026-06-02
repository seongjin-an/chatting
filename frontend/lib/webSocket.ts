import { useWebSocketStore } from "@/store/webSocketStore";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";
const HEARTBEAT_INTERVAL_MS = 30_000;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

let socket: WebSocket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

let currentToken: string | null = null;
let retryDelay = INITIAL_RETRY_DELAY_MS;
let intentionalClose = false;
let hasEverConnected = false;

export function connectWebSocket(token: string) {
  if (socket?.readyState === WebSocket.OPEN) return;
  intentionalClose = false;
  currentToken = token;
  retryDelay = INITIAL_RETRY_DELAY_MS;
  doConnect();
}

function doConnect() {
  if (!currentToken) return;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  socket = new WebSocket(`${WS_URL}?token=${currentToken}`);

  socket.onopen = () => {
    const isReconnect = hasEverConnected;
    hasEverConnected = true;
    retryDelay = INITIAL_RETRY_DELAY_MS;
    useWebSocketStore.getState().setConnected(true);
    if (isReconnect) {
      // 재연결 시 누락 메시지를 REST 히스토리로 보정
      useWebSocketStore.getState().onReconnect();
    }
    startHeartbeat();
  };

  socket.onclose = () => {
    useWebSocketStore.getState().setConnected(false);
    stopHeartbeat();
    socket = null;
    if (!intentionalClose && currentToken) {
      scheduleReconnect();
    }
  };

  socket.onerror = () => {
    useWebSocketStore.getState().setConnected(false);
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      useWebSocketStore.getState().addMessage(message);
    } catch {
      console.warn("[WS] Failed to parse message:", event.data);
    }
  };
}

function scheduleReconnect() {
  const delay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
  retryTimer = setTimeout(doConnect, delay);
}

export function disconnectWebSocket() {
  intentionalClose = true;
  hasEverConnected = false;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  stopHeartbeat();
  socket?.close();
  socket = null;
}

export function sendWebSocketMessage(payload: object) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "HEARTBEAT", payload: {} }));
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
