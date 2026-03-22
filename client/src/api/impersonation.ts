import { AuthUser } from "../types/auth";
import http from "./http";

export interface ImpersonableUser {
  id: string;
  name: string;
  email: string;
  department: string;
  team: string;
  employee_id: string;
}

export async function searchImpersonableUsers(q: string): Promise<ImpersonableUser[]> {
  const response = await http.get<ImpersonableUser[]>("/auth/impersonable-users", { params: { q } });
  return response.data;
}

export async function startImpersonationRequest(targetEmployeeId: string): Promise<AuthUser> {
  const response = await http.post<AuthUser>("/auth/impersonate", { targetEmployeeId });
  return response.data;
}
