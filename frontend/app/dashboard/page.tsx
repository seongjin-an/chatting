"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center py-3 border-b border-gray-100 last:border-0">
      <span className="w-28 text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout, isLoggingOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-indigo-600 px-6 py-8 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-white text-3xl font-bold mb-3">
            {user.name.charAt(0)}
          </div>
          <h2 className="text-white text-xl font-semibold">{user.name}</h2>
          <span className="mt-1 text-indigo-200 text-sm">{user.email}</span>
        </div>

        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            내 정보
          </h3>
          <InfoRow label="이름" value={user.name} />
          <InfoRow label="이메일" value={user.email} />
          <InfoRow label="전화번호" value={user.phone ?? "미입력"} />
          <InfoRow label="권한" value={user.role} />
          <InfoRow label="사용자 ID" value={user.id} />
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={() => router.push("/rooms")}
            className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50"
          >
            채팅방 목록
          </button>
          <button
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {isLoggingOut ? "처리 중..." : "로그아웃"}
          </button>
        </div>
      </div>
    </div>
  );
}
