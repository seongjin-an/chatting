import { create } from "zustand";
import Cookies from "js-cookie";

interface AuthStore {
  accessToken: string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  accessToken:
    typeof window !== "undefined" ? (Cookies.get("accessToken") ?? null) : null,

  setTokens: (accessToken, refreshToken) => {
    Cookies.set("accessToken", accessToken, { expires: 1 / 24 }); // 1시간
    Cookies.set("refreshToken", refreshToken, { expires: 7 });
    set({ accessToken });
  },

  clearTokens: () => {
    Cookies.remove("accessToken");
    Cookies.remove("refreshToken");
    set({ accessToken: null });
  },
}));
