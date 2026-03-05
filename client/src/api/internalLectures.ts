import http from "./http";
import {
  InternalLectureFormPayload,
  InternalLectureListResponse,
  InternalLectureRecord,
  InternalLectureUserOption
} from "../types/internalLecture";

export async function listInternalLectures(params: { search?: string; page?: number; limit?: number }) {
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
