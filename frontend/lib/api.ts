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

export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
  size: number;
  number: number;
  numberOfElements: number;
  empty: boolean;
}

export interface Channel {
  channelId: number;
  title: string;
}

export interface MessageHistory {
  channelId: number;
  messageId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: number;
}

export interface MessageCursorResult {
  nextKey: number;
  messages: MessageHistory[];
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

export const channelApi = {
  getChannels: (page = 0, size = 20) =>
    apiClient.get<ApiResponse<SpringPage<Channel>>>("/channels", {
      params: { page, size, sort: "channelId,desc" },
    }),

  getMyChannels: (page = 0, size = 20) =>
    apiClient.get<ApiResponse<SpringPage<Channel>>>("/channels/me", {
      params: { page, size, sort: "channelId,desc" },
    }),

  createChannel: (title: string) =>
    apiClient.post<ApiResponse<Channel>>("/channels", { title }),

  joinChannel: (channelId: number) =>
    apiClient.post<ApiResponse<void>>(`/channels/${channelId}/members`),

  leaveChannel: (channelId: number) =>
    apiClient.delete<ApiResponse<void>>(`/channels/${channelId}/members/me`),

  getMessages: (channelId: number, beforeSeq?: number, size = 50) =>
    apiClient.get<ApiResponse<MessageCursorResult>>(
      `/channels/${channelId}/messages`,
      { params: { ...(beforeSeq != null && { beforeSeq }), size } }
    ),

  getReadState: (channelId: number) =>
    apiClient.get<ApiResponse<Record<string, string | null>>>(
      `/channels/${channelId}/members/read-state`
    ),
};
