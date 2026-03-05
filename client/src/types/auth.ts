export type UserRole = "ADMIN" | "USER";

export interface AuthUser {
  id: string;
  email: string;
  employee_id: string;
  name: string;
  department: string;
  team: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  role: UserRole;
  firstLogin: boolean;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}
