"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useWebSocketConnection } from "@/hooks/useWebSocket";

// 앱 레벨 초기화
function WebSocketInitializer() {
  useWebSocketConnection();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketInitializer />
      {children}
    </QueryClientProvider>
  );
}
