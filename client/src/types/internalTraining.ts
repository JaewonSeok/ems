export type TrainingType = "OFFLINE" | "ONLINE";
export type CertificateStatus = "SUBMITTED" | "NOT_SUBMITTED";

export interface InternalTrainingRecord {
  id: string;
  user_id: string;
  employee_name: string;
  employee_id: string;
  training_name: string;
  type: TrainingType;
  start_date: string;
  end_date: string;
  hours: number;
  institution: string;
  certificate_status: CertificateStatus;
  certificate_file: string | null;
  credits: number | null;
  created_at: string;
  updated_at: string;
}

export interface InternalTrainingListResponse {
  items: InternalTrainingRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InternalTrainingFormPayload {
  user_id?: string;
  training_name: string;
  type: TrainingType;
  start_date: string;
  end_date: string;
  hours: number;
  institution: string;
  credits: number | null;
}

export interface InternalTrainingUserOption {
  id: string;
  name: string;
  employee_id: string;
}
