import http from "./http";
import {
  AllRecordsCategoryFilter,
  AllRecordsResponse,
  AllRecordsSortField,
  AllRecordsSortOrder
} from "../types/allRecords";

export async function listAllRecords(params: {
  search?: string;
  category?: AllRecordsCategoryFilter;
  sort?: AllRecordsSortField;
  order?: AllRecordsSortOrder;
  page?: number;
  limit?: number;
}) {
  const response = await http.get<AllRecordsResponse>("/all-records", { params });
  return response.data;
}

export async function exportAllRecords(params: {
  search?: string;
  category?: AllRecordsCategoryFilter;
  sort?: AllRecordsSortField;
  order?: AllRecordsSortOrder;
}) {
  const response = await http.get<Blob>("/all-records/export", {
    params,
    responseType: "blob"
  });

  const disposition = String(response.headers["content-disposition"] || "");
  const matched = disposition.match(/filename="?([^\"]+)"?/);
  const fileName = matched?.[1] || "all-records.xlsx";

  return {
    blob: response.data,
    fileName
  };
}
