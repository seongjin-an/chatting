import apiClient from "./axios";

export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: "USER";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const authApi = {
  signUp: (data: SignUpRequest) =>
    apiClient.post<ApiResponse<UserResponse>>("/auth/signup", data),

  login: (data: LoginRequest) =>
    apiClient.post<ApiResponse<TokenPairResponse>>("/auth/login", data),

  logout: () => apiClient.post<ApiResponse<void>>("/auth/logout"),

  refresh: (refreshToken: string) =>
    apiClient.post<ApiResponse<TokenPairResponse>>("/auth/refresh", {
      refreshToken,
    }),

  me: () => apiClient.get<ApiResponse<UserResponse>>("/auth/me"),
};
