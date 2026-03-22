export interface ExternalEducationRecord {
  no: number;
  division: string;
  team: string;
  name: string;
  educationType: string;
  educationName: string;
  startDate: string;
  endDate: string;
  days: number;
  cost: number;
  organizer: string;
  certificate: string;
}

export interface ExternalEducationRowData {
  _rowIndex: number;
  _isValid: boolean;
  _hasWarning: boolean;
  _errors: string[];
  _warnings: string[];
  no: number | string;
  division: string;
  team: string;
  name: string;
  educationType: string;
  educationName: string;
  startDate: string;
  endDate: string;
  days: number | string;
  cost: number | string;
  organizer: string;
  certificate: string;
}

export interface BulkUploadExternalResponse {
  success: boolean;
  insertedCount?: number;
  error?: string;
}
