export type StatisticsScope = "ADMIN" | "USER";

export type StatisticsCategory = "external-training" | "internal-training" | "internal-lecture" | "certification";
export type StatisticsCategoryFilter = "external-training" | "internal-training" | "internal-lecture" | "certification";

export interface StatisticsFilters {
  year: number;
  department: string;
  category: string;
}

export interface StatisticsOverviewResponse {
  filters: StatisticsFilters;
  meta: {
    departments: string[];
    scope: StatisticsScope;
  };
  monthlyHours: Array<{
    month: number;
    hours: number;
  }>;
  categoryCounts: Array<{
    category: StatisticsCategory;
    count: number;
  }>;
  typeRatios: Array<{
    type: "OFFLINE" | "ONLINE";
    count: number;
  }>;
  departmentComparison: Array<{
    department: string;
    recordCount: number;
    hours: number;
    credits: number;
  }>;
}

export interface StatisticsCostTrendResponse {
  filters: StatisticsFilters;
  items: Array<{
    month: number;
    cost: number;
  }>;
}

export interface StatisticsCompletionRateResponse {
  filters: StatisticsFilters;
  items: Array<{
    category: "external-training" | "internal-training";
    submitted: number;
    notSubmitted: number;
    approved: number;
    rejected: number;
  }>;
}

export interface StatisticsTopEmployeesResponse {
  filters: StatisticsFilters;
  items: Array<{
    userId: string;
    employeeId: string;
    name: string;
    department: string;
    team: string;
    totalHours: number;
  }>;
}

export interface StatisticsYearComparisonResponse {
  filters: StatisticsFilters;
  currentYear: number;
  previousYear: number;
  items: Array<{
    month: number;
    currentHours: number;
    previousHours: number;
    currentCount: number;
    previousCount: number;
  }>;
}
