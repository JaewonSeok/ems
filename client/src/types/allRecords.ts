export type AllRecordsCategoryFilter = "all" | "external-training" | "internal-training" | "internal-lecture" | "certification";
export type AllRecordsSortField =
  | "employee_name"
  | "department"
  | "team"
  | "category"
  | "title"
  | "type"
  | "start_date"
  | "end_date"
  | "hours"
  | "cost"
  | "certificate_status"
  | "credits"
  | "created_at";
export type AllRecordsSortOrder = "asc" | "desc";

export interface AllRecordsItem {
  id: string;
  source_id: string;
  category: "EXTERNAL_TRAINING" | "INTERNAL_TRAINING" | "INTERNAL_LECTURE" | "CERTIFICATION";
  category_label: "사외교육" | "사내교육" | "사내강의" | "자격증";
  user_id: string;
  employee_name: string;
  employee_id: string;
  department: string;
  team: string;
  title: string;
  type: "OFFLINE" | "ONLINE" | null;
  start_date: string | null;
  end_date: string | null;
  hours: number | null;
  cost: number | null;
  certificate_status: "SUBMITTED" | "NOT_SUBMITTED" | "N/A";
  credits: number | null;
  created_at: string;
}

export interface AllRecordsResponse {
  items: AllRecordsItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    search: string;
    category: AllRecordsCategoryFilter;
    sort: AllRecordsSortField;
    order: AllRecordsSortOrder;
  };
}
