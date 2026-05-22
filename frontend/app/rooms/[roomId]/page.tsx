"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  mine: boolean;
}

const MOCK_MESSAGES: Message[] = [
  { id: "1", sender: "홍길동", content: "안녕하세요!", timestamp: new Date(), mine: false },
  { id: "2", sender: "나", content: "반갑습니다.", timestamp: new Date(), mine: true },
];

export default function ChatRoomPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user) return;

    // TODO: WebSocket으로 메시지 전송
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: user.name,
        content: input.trim(),
        timestamp: new Date(),
        mine: true,
      },
    ]);
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
          <p className="text-sm font-semibold text-gray-900">채팅방 {roomId}</p>
          <p className="text-xs text-gray-400">WebSocket 연동 전 임시 UI</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.mine ? "items-end" : "items-start"}`}
          >
            {!msg.mine && (
              <span className="text-xs text-gray-500 mb-1">{msg.sender}</span>
            )}
            <div
              className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                msg.mine
                  ? "bg-indigo-600 text-white rounded-br-none"
                  : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
              }`}
            >
              {msg.content}
            </div>
            <span className="text-xs text-gray-400 mt-1">
              {msg.timestamp.toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
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
          disabled={!input.trim()}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          전송
        </button>
      </form>
    </div>
  );
}
