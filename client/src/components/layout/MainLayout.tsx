import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logoutRequest } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { useImpersonationStore } from "../../store/impersonationStore";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import ImpersonationBanner from "../impersonation/ImpersonationBanner";
import EmployeeSelectModal from "../impersonation/EmployeeSelectModal";

type NavItem = { to: string; label: string; adminOnly?: boolean; positionOnly?: boolean };

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", adminOnly: true },
  { to: "/my-dashboard", label: "내 교육 현황" },
  { to: "/external-training", label: "사외교육" },
  { to: "/internal-training", label: "사내교육" },
  { to: "/internal-lecture", label: "사내강의" },
  { to: "/certification", label: "자격증" },
  { to: "/my-credits", label: "총 학점" },
  { to: "/statistics", label: "통계", adminOnly: true },
  { to: "/team-records", label: "소속 직원 교육현황", positionOnly: true },
  { to: "/all-records", label: "전체 이력 관리", adminOnly: true },
  { to: "/user-management", label: "사용자 관리", adminOnly: true },
  { to: "/bulk-upload", label: "엑셀 일괄 업로드", adminOnly: true }
];

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearSession } = useAuthStore();
  const { targetUser, stopImpersonation } = useImpersonationStore();
  const { effectiveUser, realUser, isAdmin, isImpersonating } = useCurrentUser();
  const [showModal, setShowModal] = useState(false);

  const effectiveIsAdmin = effectiveUser?.role === "ADMIN";
  const hasPosition = Boolean(effectiveUser?.position_title);

  async function onLogout() {
    try {
      await logoutRequest();
    } catch {
      // ignore API failures and clear local session
    } finally {
      stopImpersonation();
      clearSession();
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="bg-slate-900 text-slate-100 p-4 flex flex-col">
        <h1 className="text-lg font-semibold mb-1">Education Management System</h1>
        <p className="text-xs text-slate-300 mb-1">{realUser?.name} ({realUser?.role})</p>
        {isImpersonating && (
          <p className="text-xs text-amber-400 mb-4">👁 보기: {effectiveUser?.name}</p>
        )}
        {!isImpersonating && <div className="mb-4" />}

        <nav className="space-y-2 flex-1">
          {navItems
            .filter((item) =>
              (!item.adminOnly || effectiveIsAdmin) &&
              (!item.positionOnly || hasPosition || effectiveIsAdmin)
            )
            .map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`block rounded px-3 py-2 ${isActive ? "bg-blue-700" : "bg-slate-800 hover:bg-slate-700"}`}
                >
                  {item.label}
                </Link>
              );
            })}
        </nav>

        {/* Admin: 직원 화면 보기 button */}
        {isAdmin && !isImpersonating && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full rounded px-3 py-2 mt-3 bg-indigo-700 hover:bg-indigo-600 text-sm"
          >
            직원 화면 보기
          </button>
        )}
        {isImpersonating && (
          <button
            onClick={stopImpersonation}
            className="w-full rounded px-3 py-2 mt-3 bg-amber-600 hover:bg-amber-500 text-sm"
          >
            보기 종료
          </button>
        )}

        <button onClick={onLogout} className="w-full rounded px-3 py-2 mt-2 bg-red-700 hover:bg-red-600 text-sm">
          Logout
        </button>
      </aside>

      <div className="flex flex-col bg-slate-50">
        <ImpersonationBanner />
        {/* key changes when impersonation starts/stops → forces full page remount so
            every page's useEffect re-runs with the correct X-Impersonate-User-Id header */}
        <main key={targetUser?.id ?? ""} className="p-6 flex-1">
          <Outlet />
        </main>
      </div>

      {showModal && <EmployeeSelectModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
