export interface DashboardSummary {
  totalRecords: number;
  totalHours: number;
  totalCredits: number;
  notSubmittedCount: number;
}

export interface DashboardMonthlyHoursResponse {
  year: number;
  items: Array<{
    month: number;
    hours: number;
  }>;
}

export type DashboardCategory = "EXTERNAL" | "INTERNAL" | "LECTURE";

export interface DashboardCategoryCountResponse {
  items: Array<{
    category: DashboardCategory;
    count: number;
  }>;
}

export interface DashboardDepartmentSummaryResponse {
  items: Array<{
    department: string;
    recordCount: number;
    hours: number;
    credits: number;
  }>;
}

export interface DashboardDemoSeedResponse {
  inserted: boolean;
  message: string;
}
