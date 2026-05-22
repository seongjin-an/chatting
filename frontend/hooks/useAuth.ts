"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, LoginRequest, SignUpRequest } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { AxiosError } from "axios";

export const ME_QUERY_KEY = ["me"] as const;

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const res = await authApi.me();
      return res.data.data;
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const { setTokens } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: async (res) => {
      const { accessToken, refreshToken } = res.data.data;
      setTokens(accessToken, refreshToken);
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      router.push("/dashboard");
    },
    onError: (err: AxiosError<{ message: string }>) => {
      return err.response?.data?.message ?? "로그인에 실패했습니다.";
    },
  });
}

export function useLogout() {
  const { clearTokens } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearTokens();
      queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      router.push("/login");
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: (data: SignUpRequest) => authApi.signUp(data),
  });
}

export function useAuth() {
  const { data: user, isLoading } = useCurrentUser();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  return {
    user: user ?? null,
    isAuthenticated: !!accessToken,
    isLoading: !!accessToken && isLoading,
    isLoggingOut,
    logout,
  };
}
