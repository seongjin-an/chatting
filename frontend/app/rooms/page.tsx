"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useChannels, useJoinChannel } from "@/hooks/useChannel";

export default function RoomsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data: channels = [], isLoading: isChannelsLoading } = useChannels();
  const joinChannel = useJoinChannel();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isLoading, router]);

  const filtered = channels.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  async function handleEnter(channelId: number) {
    try {
      await joinChannel.mutateAsync(channelId);
    } catch {
      // 이미 참여 중이면 무시
    }
    router.push(`/rooms/${channelId}`);
  }

  if (isLoading || isChannelsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">채팅방</h1>
        <Link
          href="/rooms/create"
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          + 방 만들기
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="채팅방 검색..."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">
            채팅방이 없습니다.
          </p>
        ) : (
          filtered.map((channel) => (
            <div
              key={channel.channelId}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <p className="text-sm font-semibold text-gray-900">
                {channel.title}
              </p>
              <button
                onClick={() => handleEnter(channel.channelId)}
                className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50"
              >
                입장
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
