"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { channelApi } from "@/lib/api";
import { useRouter } from "next/navigation";

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
  return useQuery({
    queryKey: MY_CHANNELS_KEY,
    queryFn: async () => {
      const res = await channelApi.getMyChannels();
      return res.data.data.content;
    },
  });
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
