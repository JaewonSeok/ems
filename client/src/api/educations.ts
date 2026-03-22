import http from "./http";
import type { BulkUploadExternalResponse, ExternalEducationRecord } from "../types/externalBulkUpload";

export async function bulkUploadExternalEducations(records: ExternalEducationRecord[]) {
  const response = await http.post<BulkUploadExternalResponse>("/educations/bulk-upload", { records });
  return response.data;
}
