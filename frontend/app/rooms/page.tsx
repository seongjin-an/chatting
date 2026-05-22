"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface Room {
  id: string;
  name: string;
  description: string;
  memberCount: number;
}

const MOCK_ROOMS: Room[] = [
  { id: "1", name: "일반 채팅방", description: "자유롭게 대화하세요", memberCount: 12 },
  { id: "2", name: "개발자 모임", description: "개발 관련 이야기", memberCount: 8 },
  { id: "3", name: "공지사항", description: "중요 공지", memberCount: 25 },
];

export default function RoomsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isLoading, router]);

  const filtered = MOCK_ROOMS.filter(
    (r) => r.name.includes(search) || r.description.includes(search)
  );

  if (isLoading) {
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
            검색 결과가 없습니다.
          </p>
        ) : (
          filtered.map((room) => (
            <Link
              key={room.id}
              href={`/rooms/${room.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{room.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{room.description}</p>
              </div>
              <span className="text-xs text-gray-400">{room.memberCount}명</span>
            </Link>
          ))
        )}
      </div>

      <p className="mt-4 text-xs text-center text-gray-400">
        * 채팅방 기능은 채팅 서비스 연동 후 활성화됩니다.
      </p>
    </div>
  );
}
