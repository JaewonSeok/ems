export type TrainingType = "OFFLINE" | "ONLINE";
export type CertificateStatus = "SUBMITTED" | "NOT_SUBMITTED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ExternalTrainingRecord {
  id: string;
  user_id: string;
  employee_name: string;
  employee_id: string;
  training_name: string;
  type: TrainingType;
  start_date: string;
  end_date: string;
  hours: number;
  cost: number | null;
  institution: string;
  certificate_status: CertificateStatus;
  certificate_file: string | null;
  approval_status: ApprovalStatus;
  approval_comment: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approver_name: string | null;
  credits: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalTrainingListResponse {
  items: ExternalTrainingRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ExternalTrainingFormPayload {
  user_id?: string;
  training_name: string;
  type: TrainingType;
  start_date: string;
  end_date: string;
  hours: number;
  cost: number | null;
  institution: string;
  credits: number | null;
}

export interface ExternalTrainingUserOption {
  id: string;
  name: string;
  employee_id: string;
}
