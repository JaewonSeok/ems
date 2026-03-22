import * as XLSX from "xlsx";

const HEADERS = ["No", "본부", "팀", "이름", "교육구분", "교육명", "시작일자", "종료일자", "교육일수", "교육비", "교육주관", "이수증"];

const SAMPLE_ROW = [1, "경영본부", "인사팀", "홍길동", "직무", "Excel 실무 과정", "2025-01-06", "2025-01-07", 2, 150000, "한국생산성본부", "Y"];

const COL_WIDTHS = [
  { wch: 6 },
  { wch: 14 },
  { wch: 14 },
  { wch: 10 },
  { wch: 12 },
  { wch: 26 },
  { wch: 13 },
  { wch: 13 },
  { wch: 10 },
  { wch: 12 },
  { wch: 20 },
  { wch: 8 },
];

const HEADER_STYLE = {
  fill: { patternType: "solid", fgColor: { rgb: "4472C4" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
};

export function downloadExternalEducationTemplate(): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, SAMPLE_ROW]);

  HEADERS.forEach((_, colIdx) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    const cell = ws[cellAddr];
    if (cell) {
      cell.s = HEADER_STYLE;
    }
  });

  ws["!cols"] = COL_WIDTHS;

  XLSX.utils.book_append_sheet(wb, ws, "사외교육");
  XLSX.writeFile(wb, "사외교육_일괄업로드_템플릿.xlsx");
}
