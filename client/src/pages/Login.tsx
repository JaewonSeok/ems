import { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

function getGoogleErrorMessage(error: string | null): string | null {
  if (!error) return null;
  switch (error) {
    case "user_not_found":       return "등록되지 않은 계정이거나 비활성화된 계정입니다. 관리자에게 문의하세요.";
    case "oauth_cancelled":      return "Google 로그인이 취소되었습니다.";
    case "token_exchange_failed":return "Google 인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.";
    case "userinfo_fetch_failed":return "Google 계정 정보를 가져오지 못했습니다. 다시 시도해주세요.";
    case "server_misconfigured": return "서버 설정 오류입니다. 관리자에게 문의하세요.";
    case "server_error":         return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    case "google_login_failed":  return "Google 로그인에 실패했습니다. 다시 시도해주세요.";
    default:                     return "로그인 중 오류가 발생했습니다. 다시 시도해주세요.";
  }
}

export default function Login() {
  const location = useLocation();
  const { accessToken, user } = useAuthStore();

  const googleError = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return getGoogleErrorMessage(params.get("error"));
  }, [location.search]);

  const redirectPath = useMemo(() => {
    if (!accessToken || !user) return null;
    return user.role === "ADMIN" ? "/dashboard" : "/external-training";
  }, [accessToken, user]);

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100">
      <div className="w-full max-w-sm rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg p-8">

        {/* ── Logo / Brand ── */}
        <div className="flex flex-col items-center gap-3 mb-6">
          {/* Graduation cap icon */}
          <svg viewBox="0 0 64 64" className="w-16 h-16" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#1d4ed8"/>
            <path d="M32 10 L54 21 L32 32 L10 21 Z" fill="white"/>
            <path d="M21 24 L21 39 C21 45 26 49 32 49 C38 49 43 45 43 39 L43 24"
                  fill="rgba(255,255,255,0.82)"/>
            <line x1="54" y1="21" x2="54" y2="38"
                  stroke="white" stroke-width="3.5" stroke-linecap="round"/>
            <circle cx="54" cy="42" r="4.5" fill="white"/>
          </svg>

          <div className="text-center">
            <p className="text-xl font-bold text-slate-800">교육 관리 시스템</p>
            <p className="text-xs text-slate-400 tracking-wider uppercase mt-0.5">
              Learning Management System
            </p>
          </div>
        </div>

        <hr className="border-slate-200 mb-6" />

        {/* ── Google Login Button ── */}
        <button
          type="button"
          onClick={() => { window.location.href = `${API_BASE_URL}/auth/google`; }}
          className="w-full rounded-lg border border-slate-200 bg-white text-slate-700 px-4 py-3 flex items-center justify-center gap-3 hover:bg-slate-50 hover:shadow transition font-medium text-sm"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google 계정으로 로그인
        </button>

        {/* ── Error message ── */}
        {googleError ? (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600 text-center">{googleError}</p>
          </div>
        ) : null}

        {/* ── Footer ── */}
        <p className="text-xs text-slate-400 text-center pt-6">
          © 2026 사내 교육 관리 시스템
        </p>
      </div>
    </div>
  );
}
