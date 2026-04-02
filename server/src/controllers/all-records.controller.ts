import { Response } from "express";
import XLSX from "xlsx";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  AllRecordsCategoryFilter,
  AllRecordsSortField,
  AllRecordsSortOrder,
  getUnifiedRecords,
  sortUnifiedRecords
} from "../services/all-records.service";

class QueryValidationError extends Error {}

const categoryWhitelist = new Set<AllRecordsCategoryFilter>([
  "all",
  "external-training",
  "internal-training",
  "internal-lecture",
  "certification"
]);

const sortWhitelist = new Set<AllRecordsSortField>([
  "employee_name",
  "employee_id",
  "department",
  "team",
  "category",
  "title",
  "type",
  "start_date",
  "end_date",
  "hours",
  "cost",
  "certificate_status",
  "credits",
  "created_at"
]);

const orderWhitelist = new Set<AllRecordsSortOrder>(["asc", "desc"]);

function parseCategory(value: unknown): AllRecordsCategoryFilter {
  const parsed = String(value || "all").trim() as AllRecordsCategoryFilter;

  if (!categoryWhitelist.has(parsed)) {
    throw new QueryValidationError("category is invalid");
  }

  return parsed;
}

function parseSort(value: unknown): AllRecordsSortField {
  const parsed = String(value || "start_date").trim() as AllRecordsSortField;

  if (!sortWhitelist.has(parsed)) {
    throw new QueryValidationError("sort is invalid");
  }

  return parsed;
}

function parseOrder(value: unknown): AllRecordsSortOrder {
  const parsed = String(value || "desc").trim() as AllRecordsSortOrder;

  if (!orderWhitelist.has(parsed)) {
    throw new QueryValidationError("order is invalid");
  }

  return parsed;
}

function parsePositiveInt(value: unknown, fieldName: string, fallback: number, min: number, max: number) {
  const parsed = value === undefined ? fallback : Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new QueryValidationError(`${fieldName} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

export async function listAllRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const search = String(req.query.search || "").trim();
    const category = parseCategory(req.query.category);
    const sort = parseSort(req.query.sort);
    const order = parseOrder(req.query.order);
    const page = parsePositiveInt(req.query.page, "page", 1, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, "limit", 20, 1, 100);

    const allRecords = await getUnifiedRecords({ search, category });
    const sorted = sortUnifiedRecords(allRecords, sort, order);
    const total = sorted.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const items = sorted.slice((page - 1) * limit, page * limit);

    return res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      filters: {
        search,
        category,
        sort,
        order
      }
    });
  } catch (error) {
    if (error instanceof QueryValidationError) {
      return res.status(400).json({ message: error.message });
    }

    console.error("listAllRecords error:", error);
    return res.status(500).json({ message: "Failed to list all records" });
  }
}

function toExportRows(
  records: Array<{
    employee_name: string;
    employee_id: string;
    department: string;
    team: string;
    category_label: string;
    title: string;
    type: string | null;
    start_date: string | null;
    end_date: string | null;
    hours: number | null;
    cost: number | null;
    certificate_status: string;
    credits: number | null;
  }>
) {
  return records.map((record) => ({
    이름: record.employee_name,
    사번: record.employee_id,
    부서: record.department,
    팀: record.team,
    카테고리: record.category_label,
    항목명: record.title,
    구분: record.type === "OFFLINE" ? "오프라인" : record.type === "ONLINE" ? "온라인" : "-",
    시작일: record.start_date ?? "-",
    종료일: record.end_date ?? "-",
    시간: record.hours ?? "-",
    비용: record.cost ?? "-",
    수료증: record.certificate_status,
    학점: record.credits ?? "-"
  }));
}

export async function exportAllRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const search = String(req.query.search || "").trim();
    const category = parseCategory(req.query.category);
    const sort = parseSort(req.query.sort);
    const order = parseOrder(req.query.order);

    const allRecords = await getUnifiedRecords({ search, category });
    const sorted = sortUnifiedRecords(allRecords, sort, order);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(toExportRows(sorted));
    XLSX.utils.book_append_sheet(workbook, worksheet, "AllRecords");

    const fileBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
    const fileName = `all-records-${timestamp}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(fileBuffer);
  } catch (error) {
    if (error instanceof QueryValidationError) {
      return res.status(400).json({ message: error.message });
    }

    console.error("exportAllRecords error:", error);
    return res.status(500).json({ message: "Failed to export all records" });
  }
}
