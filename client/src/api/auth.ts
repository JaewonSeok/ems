import http from "./http";
import { LoginResponse, RefreshResponse } from "../types/auth";

export async function loginRequest(email: string, password: string) {
  const response = await http.post<LoginResponse>("/auth/login", { email, password });
  return response.data;
}

export async function refreshRequest(refreshToken: string) {
  const response = await http.post<RefreshResponse>("/auth/refresh", { refreshToken });
  return response.data;
}

export async function changePasswordRequest(newPassword: string, currentPassword?: string) {
  await http.put("/auth/change-password", { newPassword, currentPassword });
}

export async function logoutRequest() {
  await http.post("/auth/logout");
}
