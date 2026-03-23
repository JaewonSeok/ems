import http from "./http";
import {
  InternalTrainingFormPayload,
  InternalTrainingListResponse,
  InternalTrainingRecord,
  InternalTrainingUserOption
} from "../types/internalTraining";

export async function listInternalTrainings(params: { search?: string; page?: number; limit?: number }) {
  const response = await http.get<InternalTrainingListResponse>("/internal-trainings", { params });
  return response.data;
}

export async function listInternalTrainingUserOptions() {
  const response = await http.get<{ items: InternalTrainingUserOption[] }>("/internal-trainings/users/options");
  return response.data.items;
}

export async function createInternalTraining(payload: InternalTrainingFormPayload) {
  const response = await http.post<InternalTrainingRecord>("/internal-trainings", payload);
  return response.data;
}

export async function updateInternalTraining(id: string, payload: InternalTrainingFormPayload) {
  const response = await http.put<InternalTrainingRecord>(`/internal-trainings/${id}`, payload);
  return response.data;
}

export async function deleteInternalTraining(id: string) {
  await http.delete(`/internal-trainings/${id}`);
}

export async function uploadInternalTrainingCertificate(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await http.post<InternalTrainingRecord>(`/internal-trainings/${id}/certificate`, formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return response.data;
}

export async function deleteInternalTrainingCertificate(id: string) {
  const response = await http.delete<InternalTrainingRecord>(`/internal-trainings/${id}/certificate`);
  return response.data;
}

export async function downloadInternalTrainingCertificate(id: string) {
  const response = await http.get<Blob>(`/internal-trainings/${id}/certificate`, {
    responseType: "blob"
  });

  const disposition = String(response.headers["content-disposition"] || "");
  const matched = disposition.match(/filename="?([^\"]+)"?/);
  const fileName = matched?.[1] || `internal-training-${id}-certificate`;

  return {
    blob: response.data,
    fileName
  };
}
