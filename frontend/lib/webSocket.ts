/**
 * 연결 / 해제 / 하트비트
 * hooks/useWebSocket.ts 에서 참조함.
 */

import { useWebSocketStore } from "@/store/webSocketStore";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";
const HEARTBEAT_INTERVAL_MS = 30_000;

let socket: WebSocket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function connectWebSocket(token: string) {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  socket = new WebSocket(`${WS_URL}?token=${token}`);

  socket.onopen = () => {
    useWebSocketStore.getState().setConnected(true);
    startHeartbeat();
  };

  socket.onclose = () => {
    useWebSocketStore.getState().setConnected(false);
    stopHeartbeat();
    socket = null;
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

export function disconnectWebSocket() {
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
