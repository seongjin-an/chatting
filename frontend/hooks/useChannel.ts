"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { channelApi } from "@/lib/api";
import { useWebSocketStore } from "@/store/webSocketStore";

export const CHANNELS_KEY = ["channels"] as const;
export const MY_CHANNELS_KEY = ["channels", "me"] as const;

export function useChannels() {
  return useQuery({
    queryKey: CHANNELS_KEY,
    queryFn: async () => {
      const res = await channelApi.getChannels();
      return res.data.data.content;
    },
  });
}

export function useMyChannels() {
  const setUnreadCounts = useWebSocketStore((s) => s.setUnreadCounts);
  const reconnectCount = useWebSocketStore((s) => s.reconnectCount);

  const query = useQuery({
    queryKey: MY_CHANNELS_KEY,
    queryFn: async () => {
      const res = await channelApi.getMyChannels();
      return res.data.data.content;
    },
  });

  // 서버에서 받은 unreadCount로 스토어 초기화 (앱 로드 + 재연결 시 동기화)
  useEffect(() => {
    if (!query.data) return;
    const counts: Record<string, number> = {};
    query.data.forEach((c) => {
      counts[String(c.channelId)] = c.unreadCount ?? 0;
    });
    setUnreadCounts(counts);
  }, [query.data, setUnreadCounts]);

  // 재연결 시 서버 기준으로 재동기화
  useEffect(() => {
    if (reconnectCount > 0) query.refetch();
  }, [reconnectCount]);

  return query;
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (title: string) => {
      const res = await channelApi.createChannel(title);
      return res.data.data;
    },
    onSuccess: async (channel) => {
      await channelApi.joinChannel(channel.channelId);
      queryClient.invalidateQueries({ queryKey: CHANNELS_KEY });
      router.push(`/rooms/${channel.channelId}`);
    },
  });
}

export function useJoinChannel() {
  return useMutation({
    mutationFn: (channelId: number) => channelApi.joinChannel(channelId),
  });
}

export function useChannelMessages(channelId: number) {
  return useQuery({
    queryKey: ["messages", channelId],
    queryFn: async () => {
      const res = await channelApi.getMessages(channelId);
      return res.data.data;
    },
    staleTime: Infinity,
  });
}

export function useInitialReadState(channelId: string) {
  const setReadState = useWebSocketStore((s) => s.setReadState);
  useEffect(() => {
    channelApi.getReadState(Number(channelId)).then((res) => {
      setReadState(channelId, res.data.data);
    });
  }, [channelId]);
}
