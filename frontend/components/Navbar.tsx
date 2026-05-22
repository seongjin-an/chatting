"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const { user, logout, isLoggingOut } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-bold text-indigo-600">
          ChatMSA
        </Link>
        {user && (
          <Link
            href="/rooms"
            className="text-sm text-gray-600 hover:text-indigo-600"
          >
            채팅방
          </Link>
        )}
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <Link
              href="/dashboard"
              className="text-sm text-gray-700 hover:text-indigo-600"
            >
              {user.name}
            </Link>
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-600 disabled:opacity-50"
            >
              {isLoggingOut ? "처리 중..." : "로그아웃"}
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-indigo-600"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="text-sm px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
            >
              회원가입
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
