import http from "./http";
import {
  ExternalTrainingFormPayload,
  ExternalTrainingListResponse,
  ExternalTrainingRecord,
  ExternalTrainingUserOption
} from "../types/externalTraining";

export async function listExternalTrainings(params: { search?: string; page?: number; limit?: number }) {
  const response = await http.get<ExternalTrainingListResponse>("/external-trainings", { params });
  return response.data;
}

export async function listExternalTrainingUserOptions() {
  const response = await http.get<{ items: ExternalTrainingUserOption[] }>("/external-trainings/users/options");
  return response.data.items;
}

export async function createExternalTraining(payload: ExternalTrainingFormPayload) {
  const response = await http.post<ExternalTrainingRecord>("/external-trainings", payload);
  return response.data;
}

export async function updateExternalTraining(id: string, payload: ExternalTrainingFormPayload) {
  const response = await http.put<ExternalTrainingRecord>(`/external-trainings/${id}`, payload);
  return response.data;
}

export async function deleteExternalTraining(id: string) {
  await http.delete(`/external-trainings/${id}`);
}

export async function uploadExternalTrainingCertificate(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await http.post<ExternalTrainingRecord>(`/external-trainings/${id}/certificate`, formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return response.data;
}

export async function downloadExternalTrainingCertificate(id: string) {
  const response = await http.get<Blob>(`/external-trainings/${id}/certificate`, {
    responseType: "blob"
  });

  const disposition = String(response.headers["content-disposition"] || "");
  const matched = disposition.match(/filename="?([^\"]+)"?/);
  const fileName = matched?.[1] || `external-training-${id}-certificate`;

  return {
    blob: response.data,
    fileName,
    contentType: String(response.headers["content-type"] || "")
  };
}

export async function approveExternalTraining(id: string) {
  const response = await http.put<ExternalTrainingRecord>(`/external-trainings/${id}/approve`);
  return response.data;
}

export async function rejectExternalTraining(id: string, comment: string) {
  const response = await http.put<ExternalTrainingRecord>(`/external-trainings/${id}/reject`, { comment });
  return response.data;
}
