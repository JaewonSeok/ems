import http from "./http";
import {
  DashboardCategoryCountResponse,
  DashboardDemoSeedResponse,
  DashboardDepartmentSummaryResponse,
  DashboardMonthlyHoursResponse,
  DashboardSummary
} from "../types/dashboard";

export async function getDashboardSummary() {
  const response = await http.get<DashboardSummary>("/dashboard/summary");
  return response.data;
}

export async function getDashboardMonthlyHours(year: number) {
  const response = await http.get<DashboardMonthlyHoursResponse>("/dashboard/monthly-hours", {
    params: { year }
  });
  return response.data;
}

export async function getDashboardCategoryCount() {
  const response = await http.get<DashboardCategoryCountResponse>("/dashboard/category-count");
  return response.data;
}

export async function getDashboardDepartmentSummary() {
  const response = await http.get<DashboardDepartmentSummaryResponse>("/dashboard/department-summary");
  return response.data;
}

export async function seedDashboardDemo() {
  const response = await http.post<DashboardDemoSeedResponse>("/dashboard/demo-seed");
  return response.data;
}
