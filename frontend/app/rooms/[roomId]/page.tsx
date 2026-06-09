"use client";

import {FormEvent, useEffect, useMemo, useRef, useState} from "react";
import {useParams, useRouter} from "next/navigation";
import {useAuth} from "@/hooks/useAuth";
import {useChat} from "@/hooks/useWebSocket";
import {useChannelMessages, useInitialReadState, useJoinChannel} from "@/hooks/useChannel";
import {sendWebSocketMessage} from "@/lib/webSocket";
import {type MessageHistory} from "@/lib/api";
import {type ContentMessage, useWebSocketStore} from "@/store/webSocketStore";

const EMPTY_READ_STATE: Record<string, string> = {};

type DisplayMessage = {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: number;
};

function toDisplay(msg: MessageHistory | ContentMessage): DisplayMessage {
  if ("userId" in msg) {
    return {
      messageId: msg.messageId,
      senderId: msg.userId,
      senderName: msg.userName,
      content: msg.content,
      createdAt: msg.createdAt,
    };
  }
  return {
    messageId: msg.messageId,
    senderId: msg.senderId,
    senderName: msg.senderName,
    content: msg.content,
    createdAt: msg.createdAt,
  };
}

// ── 읽음/안읽음 바텀시트 ────────────────────────────────────────────────────
type ReadReceiptSheetProps = {
  msg: DisplayMessage;
  readState: Record<string, string>;
  nameMap: Map<string, string>;
  onClose: () => void;
};

function ReadReceiptSheet({msg, readState, nameMap, onClose}: ReadReceiptSheetProps) {
  const [tab, setTab] = useState<"read" | "unread">("read");

  const readUsers = [
    // 발신자는 자신이 보낸 메시지를 항상 읽은 것으로 처리
    {userId: msg.senderId, name: nameMap.get(msg.senderId) ?? msg.senderName},
    ...Object.entries(readState)
    .filter(([uid, lastReadId]) => uid !== msg.senderId && BigInt(lastReadId) >= BigInt(msg.messageId))
    .map(([uid]) => ({userId: uid, name: nameMap.get(uid) ?? uid.slice(0, 8) + "…"})),
  ];

  const unreadUsers = Object.entries(readState)
  .filter(([uid]) => uid !== msg.senderId)
  .filter(([, lastReadId]) => BigInt(lastReadId) < BigInt(msg.messageId))
  .map(([uid]) => ({userId: uid, name: nameMap.get(uid) ?? uid.slice(0, 8) + "…"}));

  return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
        <div
            className="bg-white rounded-t-2xl shadow-xl max-h-[60vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div
              className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700 truncate max-w-[80%]">
              {msg.content}
            </p>
            <button onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none">
              ✕
            </button>
          </div>

          {/* 탭 */}
          <div className="flex border-b border-gray-100">
            <button
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    tab === "read"
                        ? "text-indigo-600 border-b-2 border-indigo-600"
                        : "text-gray-400"
                }`}
                onClick={() => setTab("read")}
            >
              읽음 {readUsers.length}
            </button>
            <button
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    tab === "unread"
                        ? "text-indigo-600 border-b-2 border-indigo-600"
                        : "text-gray-400"
                }`}
                onClick={() => setTab("unread")}
            >
              안읽음 {unreadUsers.length}
            </button>
          </div>

          {/* 유저 목록 */}
          <div className="overflow-y-auto flex-1 px-4 py-2">
            {(tab === "read" ? readUsers : unreadUsers).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  {tab === "read" ? "아직 읽은 사람이 없어요" : "모두 읽었어요"}
                </p>
            ) : (
                (tab === "read" ? readUsers : unreadUsers).map(({userId, name}) => (
                    <div key={userId} className="flex items-center gap-3 py-2.5">
                      <div
                          className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-800">{name}</span>
                    </div>
                ))
            )}
          </div>
        </div>
      </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function ChatRoomPage() {
  const {user, isAuthenticated, isLoading} = useAuth();
  const router = useRouter();
  const {roomId: channelId} = useParams<{ roomId: string }>();
  const {connected, messages: wsMessages, sendMessage} = useChat(channelId);
  const {data: historyResult, refetch: refetchHistory} = useChannelMessages(Number(channelId));
  const reconnectCount = useWebSocketStore((s) => s.reconnectCount);
  const readState = useWebSocketStore((s) => s.readState[channelId] ?? EMPTY_READ_STATE);
  const joinChannel = useJoinChannel();
  const [input, setInput] = useState("");
  const [selectedMsg, setSelectedMsg] = useState<DisplayMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useInitialReadState(channelId);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (reconnectCount > 0) refetchHistory();
  }, [reconnectCount]);

  // 채팅방 입장 or 재연결 시 히스토리 최신 메시지까지 읽음 처리
  useEffect(() => {
    if (!connected || !historyResult?.messages?.length) return;
    const latest = historyResult.messages.reduce((a, b) =>
        BigInt(a.messageId) > BigInt(b.messageId) ? a : b
    );
    sendWebSocketMessage({
      type: "READ_MESSAGE",
      payload: {channelId: Number(channelId), messageId: Number(latest.messageId)},
    });
  }, [historyResult, connected]);

  // 채팅방에 있는 동안 새 메시지 수신 시 읽음 처리 (페이지 마운트 상태 = 보고 있음)
  useEffect(() => {
    if (!connected || wsMessages.length === 0) return;
    const latest = wsMessages.reduce((a, b) =>
        BigInt(a.messageId) > BigInt(b.messageId) ? a : b
    );
    sendWebSocketMessage({
      type: "READ_MESSAGE",
      payload: {channelId: Number(channelId), messageId: Number(latest.messageId)},
    });
  }, [wsMessages]);

  useEffect(() => {
    if (!isAuthenticated) return;
    joinChannel.mutate(Number(channelId));
  }, [channelId, isAuthenticated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: "smooth"});
  }, [wsMessages, historyResult]);

  const allMessages = useMemo<DisplayMessage[]>(() => {
    const history = (historyResult?.messages ?? []).map(toDisplay);
    const realtime = wsMessages.map(toDisplay);
    const seen = new Set<string>();
    const merged: DisplayMessage[] = [];
    for (const msg of [...history, ...realtime]) {
      if (!seen.has(msg.messageId)) {
        seen.add(msg.messageId);
        merged.push(msg);
      }
    }
    return merged.sort((a, b) => {
      const aId = BigInt(a.messageId);
      const bId = BigInt(b.messageId);
      return aId < bId ? -1 : aId > bId ? 1 : 0;
    });
  }, [historyResult, wsMessages]);

  // 메시지에서 userId→name 맵 구성 (이름 없는 멤버는 userId 앞 8자로 표시)
  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (user) map.set(String(user.id), user.name);
    allMessages.forEach((msg) => map.set(msg.senderId, msg.senderName));
    return map;
  }, [allMessages, user]);

  function getUnreadCount(msg: DisplayMessage): number {
    const entries = Object.entries(readState).filter(([uid]) => uid !== msg.senderId);
    if (entries.length === 0) return 0;
    return entries.filter(([, lastReadId]) => BigInt(lastReadId) < BigInt(msg.messageId)).length;
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  }

  if (isLoading || !user) {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"/>
        </div>
    );
  }

  return (
      <div className="flex flex-col h-[calc(100vh-57px)]">
        {/* 헤더 */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
              onClick={() => router.push("/rooms")}
              className="text-gray-400 hover:text-gray-600 text-lg"
          >
            ←
          </button>
          <div>
            <p className="text-sm font-semibold text-gray-900">채팅방 {channelId}</p>
            <p className="text-xs text-gray-400">{connected ? "연결됨" : "연결 중..."}</p>
          </div>
        </div>

        {/* 메시지 목록 */}
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
            const unreadCount = getUnreadCount(msg);

            if (mine) {
              return (
                  <div key={msg.messageId} className={isContinued ? "" : "mt-2"}>
                    <div className="flex items-end gap-1.5 ml-auto w-fit max-w-[70%]">
                      {unreadCount > 0 && (
                          <span className="text-xs text-indigo-500 font-medium shrink-0 mb-0.5">
                      {unreadCount}
                    </span>
                      )}
                      <span className="text-xs text-gray-400 shrink-0 mb-0.5">{time}</span>
                      <div
                          className="px-3.5 py-2 rounded-2xl rounded-br-sm bg-indigo-500 text-white text-sm leading-relaxed break-words cursor-pointer active:opacity-80"
                          onClick={() => setSelectedMsg(msg)}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
              );
            }

            return (
                <div
                    key={msg.messageId}
                    className={`flex items-end gap-2 ${isContinued ? "" : "mt-2"}`}
                >
                  {!isContinued ? (
                      <div
                          className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 self-start">
                        {initial}
                      </div>
                  ) : (
                      <div className="w-8 shrink-0"/>
                  )}
                  <div className="flex flex-col items-start max-w-[70%]">
                    {!isContinued && (
                        <span className="text-xs font-semibold text-gray-500 mb-1 px-1">
                    {msg.senderName}
                  </span>
                    )}
                    <div className="flex items-end gap-1.5">
                      <div
                          className="px-3.5 py-2 rounded-2xl rounded-bl-sm bg-white border border-gray-200 text-gray-800 text-sm leading-relaxed break-words cursor-pointer active:opacity-80"
                          onClick={() => setSelectedMsg(msg)}
                      >
                        {msg.content}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 mb-0.5">{time}</span>
                      {unreadCount > 0 && (
                          <span className="text-xs text-indigo-500 font-medium shrink-0 mb-0.5">
                      {unreadCount}
                    </span>
                      )}
                    </div>
                  </div>
                </div>
            );
          })}
          <div ref={bottomRef}/>
        </div>

        {/* 입력창 */}
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

        {/* 읽음/안읽음 바텀시트 */}
        {selectedMsg && (
            <ReadReceiptSheet
                msg={selectedMsg}
                readState={readState}
                nameMap={nameMap}
                onClose={() => setSelectedMsg(null)}
            />
        )}
      </div>
  );
}
