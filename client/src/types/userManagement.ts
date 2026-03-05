export type UserRole = "ADMIN" | "USER";
export type UserStatusFilter = "all" | "active" | "inactive";

export interface ManagedUser {
  id: string;
  email: string;
  employee_id: string;
  name: string;
  department: string;
  team: string;
  role: UserRole;
  is_first_login: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  items: ManagedUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    search: string;
    role: "all" | UserRole;
    status: UserStatusFilter;
  };
}

export interface UserFormPayload {
  email: string;
  employee_id: string;
  name: string;
  department: string;
  team: string;
  role: UserRole;
}

export interface UserBulkUploadResult {
  createdCount: number;
  failedCount: number;
  failedRows: Array<{
    row: number;
    message: string;
  }>;
}
