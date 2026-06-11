"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { connectWebSocket, disconnectWebSocket, sendWebSocketMessage } from "@/lib/webSocket";
import { useWebSocketStore } from "@/store/webSocketStore";
import { MY_CHANNELS_KEY } from "@/hooks/useChannel";

// 앱 레벨에서 한 번만 호출 — 인증 상태에 따라 연결/해제
export function useWebSocketConnection() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) {
      disconnectWebSocket();
      // 로그아웃 시 사용자별 상태 완전 초기화
      // 같은 브라우저에서 다른 유저가 로그인해도 이전 유저의 상태가 남지 않도록
      useWebSocketStore.setState({
        connected: false,
        messages: {},
        readState: {},
        unreadCounts: {},
        clearedChannels: new Set<string>(),
        activeChannelId: null,
        reconnectCount: 0,
      });
      queryClient.clear();
      return;
    }
    connectWebSocket(accessToken);
    return () => disconnectWebSocket();
  }, [accessToken, queryClient]);
}

const EMPTY_MESSAGES: import("@/store/webSocketStore").ContentMessage[] = [];

// 채팅방 페이지에서 사용
export function useChat(channelId: string) {
  const connected = useWebSocketStore((s) => s.connected);
  const messages = useWebSocketStore((s) => s.messages[channelId] ?? EMPTY_MESSAGES);
  const setActiveChannel = useWebSocketStore((s) => s.setActiveChannel);
  const queryClient = useQueryClient();

  // 채팅방 진입/이탈 시 activeChannelId 관리 — 미읽음 카운터와 연동
  useEffect(() => {
    setActiveChannel(channelId);
    return () => {
      setActiveChannel(null);
      // 퇴장 시 채널 목록 캐시 무효화 → rooms 페이지 재마운트 시 서버 최신값 즉시 반영
      queryClient.invalidateQueries({ queryKey: MY_CHANNELS_KEY });
    };
  }, [channelId, setActiveChannel, queryClient]);

  function sendMessage(content: string) {
    if (!content.trim()) return;
    sendWebSocketMessage({
      type: "SEND_MESSAGE",
      payload: {
        channelId: Number(channelId),
        content: content.trim(),
        clientMessageId: crypto.randomUUID(),
      },
    });
  }

  return { connected, messages, sendMessage };
}
