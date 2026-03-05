import http from "./http";
import { BulkUploadCategory, BulkUploadResult } from "../types/bulkUpload";

export async function downloadBulkUploadTemplate(category: BulkUploadCategory) {
  const response = await http.get<Blob>(`/bulk-upload/template/${category}`, {
    responseType: "blob"
  });

  const disposition = String(response.headers["content-disposition"] || "");
  const matched = disposition.match(/filename="?([^\"]+)"?/);
  const fileName = matched?.[1] || `${category}-template.xlsx`;

  return {
    blob: response.data,
    fileName
  };
}

export async function uploadBulkUploadFile(category: BulkUploadCategory, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await http.post<BulkUploadResult>(`/bulk-upload/${category}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return response.data;
}
