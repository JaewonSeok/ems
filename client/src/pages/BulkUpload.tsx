import { useRef, useState } from "react";
import { downloadBulkUploadTemplate, uploadBulkUploadFile } from "../api/bulkUpload";
import { BulkUploadCategory, BulkUploadResult } from "../types/bulkUpload";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];

const categoryOptions: Array<{ value: BulkUploadCategory; label: string }> = [
  { value: "external-training", label: "사외교육" },
  { value: "internal-training", label: "사내교육" },
  { value: "internal-lecture", label: "사내강의" },
  { value: "certification", label: "자격증" }
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeResponse = error as {
      response?: {
        data?: {
          message?: string;
        };
      };
    };

    const message = maybeResponse.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "일괄 업로드 처리 중 오류가 발생했습니다.";
}

function hasAllowedExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function validateFile(file: File) {
  if (!hasAllowedExtension(file.name)) {
    throw new Error("허용된 확장자는 .xlsx, .xls 입니다.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("최대 파일 크기는 10MB입니다.");
  }
}

export default function BulkUpload() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [category, setCategory] = useState<BulkUploadCategory>("external-training");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkUploadResult | null>(null);

  async function onDownloadTemplate() {
    setDownloading(true);
    setError(null);

    try {
      const template = await downloadBulkUploadTemplate(category);
      const objectUrl = URL.createObjectURL(template.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = template.fileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(getErrorMessage(downloadError));
    } finally {
      setDownloading(false);
    }
  }

  function assignFile(file: File | null) {
    if (!file) {
      return;
    }

    try {
      validateFile(file);
      setSelectedFile(file);
      setError(null);
      setResult(null);
    } catch (validationError) {
      setSelectedFile(null);
      setError(getErrorMessage(validationError));
    }
  }

  async function onUpload() {
    if (!selectedFile) {
      setError("업로드할 파일을 선택해주세요.");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      validateFile(selectedFile);
      const uploadResult = await uploadBulkUploadFile(category, selectedFile);
      setResult(uploadResult);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold">엑셀 일괄 업로드</h2>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <section className="space-y-3">
          <h3 className="text-base font-semibold">1. 카테고리 선택</h3>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setCategory(option.value);
                  setResult(null);
                  setError(null);
                }}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  category === option.value
                    ? "border-blue-600 text-blue-700 bg-blue-50"
                    : "border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold">2. 템플릿 다운로드</h3>
          <p className="text-sm text-slate-600">아래 버튼을 클릭하여 엑셀 템플릿을 다운로드한 후, 데이터를 입력하세요.</p>
          <button
            onClick={() => void onDownloadTemplate()}
            disabled={downloading}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {downloading
              ? "템플릿 다운로드 중..."
              : `📥 ${categoryOptions.find((option) => option.value === category)?.label || ""} 템플릿 다운로드`}
          </button>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold">3. 파일 업로드</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              assignFile(event.target.files?.[0] || null);
              event.target.value = "";
            }}
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragActive(false);
              const droppedFile = event.dataTransfer.files?.[0] || null;
              assignFile(droppedFile);
            }}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center ${
              dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
            }`}
          >
            <p className="text-base font-medium text-slate-800">☁️ 엑셀 파일을 선택하세요</p>
            <p className="mt-1 text-sm text-slate-500">(.xlsx, .xls)</p>
          </div>

          {selectedFile && <p className="text-sm text-slate-700">선택 파일: {selectedFile.name}</p>}

          <button
            onClick={() => void onUpload()}
            disabled={uploading}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? "일괄 등록 중..." : "일괄 등록"}
          </button>
        </section>
      </article>

      {error && (
        <article className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-700">{error}</p>
        </article>
      )}

      {result && (
        <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h3 className="text-base font-semibold">업로드 결과</h3>
          <p className="text-sm text-slate-700">
            성공 <strong>{result.createdCount}</strong>건 / 실패 <strong>{result.failedCount}</strong>건
          </p>

          {result.failedRows.length > 0 && (
            <div className="max-h-64 overflow-auto rounded border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="py-2 px-3">행 번호</th>
                    <th className="py-2 px-3">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {result.failedRows.map((row) => (
                    <tr key={`${row.row}:${row.reason}`} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-2 px-3">{row.row}</td>
                      <td className="py-2 px-3 text-rose-700">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}

      <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="font-semibold text-amber-900">안내사항</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
          <li>사번은 시스템에 등록된 사번이어야 합니다.</li>
          <li>날짜는 YYYY-MM-DD 형식입니다.</li>
          <li>첫 행은 헤더, 두 번째 행부터 데이터입니다.</li>
          <li>최대 10MB</li>
        </ul>
      </article>
    </section>
  );
}
