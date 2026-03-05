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
