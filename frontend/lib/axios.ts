import axios from "axios";
import Cookies from "js-cookie";
import { useAuthStore } from "@/store/authStore";

const apiClient = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = Cookies.get("refreshToken");
      if (refreshToken) {
        try {
          const res = await axios.post(
            "/api/auth/refresh",
            { refreshToken },
            { headers: { "Content-Type": "application/json" } }
          );
          const { accessToken, refreshToken: newRefresh } = res.data.data;
          useAuthStore.getState().setTokens(accessToken, newRefresh);
          original.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(original);
        } catch {
          useAuthStore.getState().clearTokens();
        }
      } else {
        useAuthStore.getState().clearTokens();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
