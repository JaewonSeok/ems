import { useImpersonationStore } from "../../store/impersonationStore";

export default function ImpersonationBanner() {
  const { targetUser, stopImpersonation } = useImpersonationStore();

  if (!targetUser) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-amber-400 text-amber-900 text-sm font-medium">
      <span>
        👁 현재 <strong>{targetUser.name}</strong> ({targetUser.department} / {targetUser.team}) 화면으로 보는 중 — 읽기 전용
      </span>
      <button
        onClick={stopImpersonation}
        className="ml-4 rounded bg-amber-700 px-3 py-1 text-white text-xs hover:bg-amber-800"
      >
        보기 종료
      </button>
    </div>
  );
}
