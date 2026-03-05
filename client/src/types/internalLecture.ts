export type TrainingType = "OFFLINE" | "ONLINE";

export interface InternalLectureRecord {
  id: string;
  user_id: string;
  employee_name: string;
  employee_id: string;
  lecture_name: string;
  type: TrainingType;
  start_date: string;
  end_date: string;
  hours: number;
  department_instructor: string;
  credits: number | null;
  created_at: string;
  updated_at: string;
}

export interface InternalLectureListResponse {
  items: InternalLectureRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InternalLectureFormPayload {
  user_id?: string;
  lecture_name: string;
  type: TrainingType;
  start_date: string;
  end_date: string;
  hours: number;
  department_instructor: string;
  credits: number | null;
}

export interface InternalLectureUserOption {
  id: string;
  name: string;
  employee_id: string;
}
