"use client";

import { useState, useEffect, useRef, FormEvent, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useWebSocket";
import { useChannelMessages, useJoinChannel } from "@/hooks/useChannel";
import { type MessageHistory } from "@/lib/api";
import { type ContentMessage } from "@/store/webSocketStore";

type DisplayMessage = {
  seq: number;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: number;
};

function toDisplay(msg: MessageHistory | ContentMessage): DisplayMessage {
  // MessageHistory(REST)는 userId, ContentMessage(WS)는 senderId — messageId는 양쪽 다 있어서 판별 불가
  if ("userId" in msg) {
    return {
      seq: msg.messageId,
      senderId: msg.userId,
      senderName: msg.userName,
      content: msg.content,
      createdAt: msg.createdAt,
    };
  }
  return {
    seq: msg.seq,
    senderId: msg.senderId,
    senderName: msg.senderName,
    content: msg.content,
    createdAt: msg.createdAt,
  };
}

export default function ChatRoomPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { roomId: channelId } = useParams<{ roomId: string }>();
  const { connected, messages: wsMessages, sendMessage } = useChat(channelId);
  const { data: historyResult } = useChannelMessages(Number(channelId));
  const joinChannel = useJoinChannel();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isLoading, router]);

  // 방 입장 시 자동 참여
  useEffect(() => {
    if (!isAuthenticated) return;
    joinChannel.mutate(Number(channelId));
  }, [channelId, isAuthenticated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [wsMessages, historyResult]);

  // 히스토리 + WS 메시지를 seq 기준으로 합산, 중복 제거
  const allMessages = useMemo<DisplayMessage[]>(() => {
    const history = (historyResult?.messages ?? []).map(toDisplay);
    const realtime = wsMessages.map(toDisplay);
    const seqSet = new Set<number>();
    const merged: DisplayMessage[] = [];
    for (const msg of [...history, ...realtime]) {
      if (!seqSet.has(msg.seq)) {
        seqSet.add(msg.seq);
        merged.push(msg);
      }
    }
    return merged.sort((a, b) => a.seq - b.seq);
  }, [historyResult, wsMessages]);

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  }

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/rooms")}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          ←
        </button>
        <div>
          <p className="text-sm font-semibold text-gray-900">
            채팅방 {channelId}
          </p>
          <p className="text-xs text-gray-400">
            {connected ? "연결됨" : "연결 중..."}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {allMessages.map((msg, idx) => {
          const mine = String(msg.senderId) === String(user.id);
          const prev = allMessages[idx - 1];
          const isContinued = !!prev && prev.senderId === msg.senderId;
          const initial = msg.senderName?.charAt(0)?.toUpperCase() ?? "?";
          const time = new Date(msg.createdAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          if (mine) {
            return (
              <div key={msg.seq} className={isContinued ? "" : "mt-2"}>
                <div className="flex items-end gap-1.5 ml-auto w-fit max-w-[70%]">
                  <span className="text-xs text-gray-400 shrink-0 mb-0.5">{time}</span>
                  <div className="px-3.5 py-2 rounded-2xl rounded-br-sm bg-indigo-500 text-white text-sm leading-relaxed break-words">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.seq} className={`flex items-end gap-2 ${isContinued ? "" : "mt-2"}`}>
              {!isContinued ? (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 self-start">
                  {initial}
                </div>
              ) : (
                <div className="w-8 shrink-0" />
              )}
              <div className="flex flex-col items-start max-w-[70%]">
                {!isContinued && (
                  <span className="text-xs font-semibold text-gray-500 mb-1 px-1">
                    {msg.senderName}
                  </span>
                )}
                <div className="flex items-end gap-1.5">
                  <div className="px-3.5 py-2 rounded-2xl rounded-bl-sm bg-white border border-gray-200 text-gray-800 text-sm leading-relaxed break-words">
                    {msg.content}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 mb-0.5">{time}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="bg-white border-t border-gray-200 px-4 py-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || !connected}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          전송
        </button>
      </form>
    </div>
  );
}
