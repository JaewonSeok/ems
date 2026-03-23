type Props = {
  url: string;
  fileName: string;
  contentType: string;
  onClose: () => void;
  onDownload: () => void;
};

export default function CertificatePreviewModal({ url, fileName, contentType, onClose, onDownload }: Props) {
  const isImage =
    contentType.startsWith("image/") ||
    /\.(jpg|jpeg|png)$/i.test(fileName);
  const isPdf =
    contentType === "application/pdf" ||
    /\.pdf$/i.test(fileName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="bg-white rounded-lg shadow-xl flex flex-col overflow-hidden"
        style={{ width: "min(800px, 95vw)", maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <span className="text-sm font-medium text-slate-700 truncate max-w-[650px]">{fileName}</span>
          <button
            onClick={onClose}
            className="ml-4 text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto min-h-0 bg-slate-100 flex items-center justify-center p-2">
          {isImage && (
            <img src={url} alt={fileName} className="max-w-full h-auto block rounded shadow" />
          )}
          {isPdf && (
            <iframe
              src={url}
              title={fileName}
              className="w-full rounded"
              style={{ height: "calc(80vh - 120px)", border: "none" }}
            />
          )}
          {!isImage && !isPdf && (
            <p className="text-slate-500 text-sm">미리보기를 지원하지 않는 파일 형식입니다.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t shrink-0">
          <button
            onClick={onDownload}
            className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-600"
          >
            ⬇ 다운로드
          </button>
          <button
            onClick={onClose}
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
