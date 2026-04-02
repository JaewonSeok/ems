export interface CertificationRecord {
  id: string;
  user_id: string;
  employee_name: string;
  employee_id: string;
  department: string;
  team: string;
  cert_name: string;
  grade: string;
  acquired_date: string;
  credits: number | null;
  certificate_file: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertificationListResponse {
  items: CertificationRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CertificationFormPayload {
  user_id?: string;
  cert_name: string;
  grade: string;
  acquired_date: string;
  credits: number | null;
}

export interface CertificationUserOption {
  id: string;
  name: string;
  employee_id: string;
}
