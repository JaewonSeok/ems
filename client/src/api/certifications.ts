import http from "./http";
import {
  CertificationFormPayload,
  CertificationListResponse,
  CertificationRecord,
  CertificationUserOption
} from "../types/certification";

export async function listCertifications(params: { search?: string; page?: number; limit?: number }) {
  const response = await http.get<CertificationListResponse>("/certifications", { params });
  return response.data;
}

export async function listCertificationUserOptions() {
  const response = await http.get<{ items: CertificationUserOption[] }>("/certifications/users/options");
  return response.data.items;
}

export async function createCertification(payload: CertificationFormPayload) {
  const response = await http.post<CertificationRecord>("/certifications", payload);
  return response.data;
}

export async function updateCertification(id: string, payload: CertificationFormPayload) {
  const response = await http.put<CertificationRecord>(`/certifications/${id}`, payload);
  return response.data;
}

export async function deleteCertification(id: string) {
  await http.delete(`/certifications/${id}`);
}

export async function uploadCertificationCertificate(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await http.post<CertificationRecord>(`/certifications/${id}/certificate`, formData);
  return response.data;
}

export async function downloadCertificationCertificate(id: string) {
  const response = await http.get<Blob>(`/certifications/${id}/certificate`, {
    responseType: "blob"
  });

  const disposition = String(response.headers["content-disposition"] || "");
  const matched = disposition.match(/filename="?([^"]+)"?/);
  const fileName = matched?.[1] || `certification-${id}-certificate`;

  return {
    blob: response.data,
    fileName,
    contentType: String(response.headers["content-type"] || "")
  };
}

export async function deleteCertificationCertificate(id: string) {
  const response = await http.delete<CertificationRecord>(`/certifications/${id}/certificate`);
  return response.data;
}
