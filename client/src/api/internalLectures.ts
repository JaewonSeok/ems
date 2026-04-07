import http from "./http";
import {
  InternalLectureFormPayload,
  InternalLectureListResponse,
  InternalLectureRecord,
  InternalLectureUserOption
} from "../types/internalLecture";

export async function listInternalLectures(params: { search?: string; page?: number; limit?: number; year?: number | string }) {
  const response = await http.get<InternalLectureListResponse>("/internal-lectures", { params });
  return response.data;
}

export async function listInternalLectureUserOptions() {
  const response = await http.get<{ items: InternalLectureUserOption[] }>("/internal-lectures/users/options");
  return response.data.items;
}

export async function createInternalLecture(payload: InternalLectureFormPayload) {
  const response = await http.post<InternalLectureRecord>("/internal-lectures", payload);
  return response.data;
}

export async function updateInternalLecture(id: string, payload: InternalLectureFormPayload) {
  const response = await http.put<InternalLectureRecord>(`/internal-lectures/${id}`, payload);
  return response.data;
}

export async function deleteInternalLecture(id: string) {
  await http.delete(`/internal-lectures/${id}`);
}

export async function uploadInternalLectureCertificate(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await http.post<InternalLectureRecord>(`/internal-lectures/${id}/certificate`, formData);
  return response.data;
}

export async function downloadInternalLectureCertificate(id: string) {
  const response = await http.get<Blob>(`/internal-lectures/${id}/certificate`, {
    responseType: "blob"
  });

  const disposition = String(response.headers["content-disposition"] || "");
  const matched = disposition.match(/filename="?([^"]+)"?/);
  const fileName = matched?.[1] || `internal-lecture-${id}-certificate`;

  return {
    blob: response.data,
    fileName,
    contentType: String(response.headers["content-type"] || "")
  };
}

export async function deleteInternalLectureCertificate(id: string) {
  const response = await http.delete<InternalLectureRecord>(`/internal-lectures/${id}/certificate`);
  return response.data;
}

export interface DistributeResult {
  message: string;
  created_count: number;
  skipped_duplicate: number;
  skipped_invalid: number;
  total_requested: number;
}

export async function distributeToLectures(lectureId: string, attendeeIds: string[]) {
  const response = await http.post<DistributeResult>(
    `/internal-lectures/${lectureId}/distribute`,
    { attendee_ids: attendeeIds }
  );
  return response.data;
}
