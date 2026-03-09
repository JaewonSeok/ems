export type UserRole = "ADMIN" | "USER";
export type UserStatusFilter = "all" | "active" | "inactive";
export type PositionTitle = "팀장" | "실장" | "부문장" | "본부장";

export interface ManagedUser {
  id: string;
  email: string;
  employee_id: string;
  name: string;
  department: string;
  team: string;
  role: UserRole;
  position_title: PositionTitle | null;
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
  position_title: PositionTitle | "";
}

export interface UserBulkUploadResult {
  createdCount: number;
  failedCount: number;
  failedRows: Array<{
    row: number;
    message: string;
  }>;
}
