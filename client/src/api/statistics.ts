import http from "./http";
import {
  StatisticsCompletionRateResponse,
  StatisticsCostTrendResponse,
  StatisticsOverviewResponse,
  StatisticsTopEmployeesResponse,
  StatisticsYearComparisonResponse
} from "../types/statistics";

export type StatisticsQuery = {
  year: number;
  department?: string;
  category?: string;
};

export async function getStatisticsOverview(params: StatisticsQuery) {
  const response = await http.get<StatisticsOverviewResponse>("/statistics/overview", { params });
  return response.data;
}

export async function getStatisticsCostTrend(params: StatisticsQuery) {
  const response = await http.get<StatisticsCostTrendResponse>("/statistics/cost-trend", { params });
  return response.data;
}

export async function getStatisticsCompletionRate(params: StatisticsQuery) {
  const response = await http.get<StatisticsCompletionRateResponse>("/statistics/completion-rate", { params });
  return response.data;
}

export async function getStatisticsTopEmployees(params: StatisticsQuery) {
  const response = await http.get<StatisticsTopEmployeesResponse>("/statistics/top-employees", { params });
  return response.data;
}

export async function getStatisticsYearComparison(params: StatisticsQuery) {
  const response = await http.get<StatisticsYearComparisonResponse>("/statistics/year-comparison", { params });
  return response.data;
}
