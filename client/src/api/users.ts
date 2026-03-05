import http from "./http";
import {
  ManagedUser,
  UserBulkUploadResult,
  UserFormPayload,
  UserListResponse,
  UserRole,
  UserStatusFilter
} from "../types/userManagement";

export async function listUsers(params: {
  search?: string;
  role?: "all" | UserRole;
  status?: UserStatusFilter;
  page?: number;
  limit?: number;
}) {
  const response = await http.get<UserListResponse>("/users", { params });
  return response.data;
}

export async function createUser(payload: UserFormPayload) {
  const response = await http.post<ManagedUser>("/users", payload);
  return response.data;
}

export async function updateUser(id: string, payload: UserFormPayload) {
  const response = await http.put<ManagedUser>(`/users/${id}`, payload);
  return response.data;
}

export async function deactivateUser(id: string) {
  const response = await http.put<{ message: string; user: ManagedUser }>(`/users/${id}/deactivate`);
  return response.data;
}

export async function activateUser(id: string) {
  const response = await http.put<{ message: string; user: ManagedUser }>(`/users/${id}/activate`);
  return response.data;
}

export async function resetUserPassword(id: string) {
  const response = await http.put<{ message: string }>(`/users/${id}/reset-password`);
  return response.data;
}

export async function downloadUserTemplate() {
  const response = await http.get<Blob>("/users/template", { responseType: "blob" });
  const disposition = String(response.headers["content-disposition"] || "");
  const matched = disposition.match(/filename="?([^\"]+)"?/);
  const fileName = matched?.[1] || "users-template.xlsx";

  return {
    blob: response.data,
    fileName
  };
}

export async function bulkUploadUsers(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await http.post<UserBulkUploadResult>("/users/bulk-upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return response.data;
}
