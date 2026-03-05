export type BulkUploadCategory = "external-training" | "internal-training" | "internal-lecture" | "certification";

export interface BulkUploadRowError {
  row: number;
  reason: string;
}

export interface BulkUploadResult {
  category: BulkUploadCategory;
  createdCount: number;
  failedCount: number;
  totalRows: number;
  failedRows: BulkUploadRowError[];
}
