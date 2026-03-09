import http from "./http";
import { PositionTitle } from "../types/userManagement";

export interface TeamMember {
  id: string;
  name: string;
  employee_id: string;
  department: string;
  team: string;
  position_title: PositionTitle | null;
}

export interface TeamMembersResponse {
  items: TeamMember[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  scope: {
    position_title: PositionTitle | null;
    department: string;
    team: string;
  };
}

export interface TeamSummaryMember extends TeamMember {
  training_count: number;
  has_training: boolean;
}

export interface TeamSummaryResponse {
  year: number;
  scope: {
    position_title: PositionTitle | null;
    department: string;
    team: string;
  };
  summary: {
    totalMembers: number;
    membersWithTraining: number;
    completionRate: number;
  };
  members: TeamSummaryMember[];
}

export interface TrainingRecord {
  id: string;
  training_name?: string;
  lecture_name?: string;
  cert_name?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  acquired_date?: string;
  hours?: number;
  credits?: number | null;
  institution?: string;
  grade?: string;
}

export interface MemberRecordsResponse {
  member: {
    id: string;
    name: string;
    employee_id: string;
    department: string;
    team: string;
  };
  records: {
    externalTrainings: TrainingRecord[];
    internalTrainings: TrainingRecord[];
    internalLectures: TrainingRecord[];
    certifications: TrainingRecord[];
  };
}

export async function listTeamMembers(params?: { page?: number; limit?: number; search?: string }) {
  const response = await http.get<TeamMembersResponse>("/team-records/members", { params });
  return response.data;
}

export async function getTeamSummary(year?: number) {
  const response = await http.get<TeamSummaryResponse>("/team-records/summary", { params: { year } });
  return response.data;
}

export async function getMemberRecords(memberId: string, params?: { startDate?: string; endDate?: string }) {
  const response = await http.get<MemberRecordsResponse>(`/team-records/members/${memberId}/records`, { params });
  return response.data;
}
