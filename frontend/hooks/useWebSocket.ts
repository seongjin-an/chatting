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

const EMPTY_MESSAGES: import("@/store/webSocketStore").ContentMessage[] = [];

// 채팅방 페이지에서 사용
export function useChat(channelId: string) {
  const connected = useWebSocketStore((s) => s.connected);
  // getMessages()는 매 호출마다 새 [] 참조를 반환해 무한루프 유발
  // → 스토어 상태를 직접 선택하고 빈 배열은 모듈 레벨 상수로 처리
  const messages = useWebSocketStore((s) => s.messages[channelId] ?? EMPTY_MESSAGES);

  function sendMessage(content: string) {
    if (!content.trim()) return;
    sendWebSocketMessage({
      type: "SEND_MESSAGE",
      payload: {
        channelId: Number(channelId),
        content: content.trim(),
        // 재전송 시에도 동일 ID가 유지되어야 서버가 중복 저장을 막을 수 있다
        clientMessageId: crypto.randomUUID(),
      },
    });
  }

  return { connected, messages, sendMessage };
}
