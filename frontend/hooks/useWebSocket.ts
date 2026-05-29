/**
 * 연결 / 해제 / 하트비트
 */
"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { connectWebSocket, disconnectWebSocket, sendWebSocketMessage } from "@/lib/webSocket";
import { useWebSocketStore } from "@/store/webSocketStore";

// 앱 레벨에서 한 번만 호출 — 인증 상태에 따라 연결/해제
export function useWebSocketConnection() {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      disconnectWebSocket();
      return;
    }
    connectWebSocket(accessToken);
    return () => disconnectWebSocket();
  }, [accessToken]);
}

// 채팅방 페이지에서 사용
export function useChat(roomId: string) {
  const connected = useWebSocketStore((s) => s.connected);
  const messages = useWebSocketStore((s) => s.getMessages(roomId));

  function sendMessage(content: string) {
    if (!content.trim()) return;
    sendWebSocketMessage({
      type: "SEND_MESSAGE",
      payload: { roomId: Number(roomId), content: content.trim() },
    });
  }

  return { connected, messages, sendMessage };
}
