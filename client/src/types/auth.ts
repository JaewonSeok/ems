export type UserRole = "ADMIN" | "USER";
export type PositionTitle = "팀장" | "실장" | "부문장" | "본부장";

export interface AuthUser {
  id: string;
  email: string;
  employee_id: string;
  name: string;
  department: string;
  team: string;
  role: UserRole;
  position_title?: PositionTitle | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  role: UserRole;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}
