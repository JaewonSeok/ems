import { FormEvent, useMemo, useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { loginRequest } from "../api/auth";
import { useAuthStore } from "../store/authStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://ems-9j17.onrender.com/api";

function getGoogleErrorMessage(error: string | null): string | null {
  if (!error) return null;
  if (error === "user_not_found") return "등록되지 않은 계정입니다. 관리자에게 문의하세요.";
  if (error === "google_login_failed") return "Google 로그인에 실패했습니다. 다시 시도해주세요.";
  return "로그인 중 오류가 발생했습니다.";
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, user, firstLogin, setSession } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const googleError = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return getGoogleErrorMessage(params.get("error"));
  }, [location.search]);

  const redirectPath = useMemo(() => {
    if (!accessToken || !user) {
      return null;
    }

    if (firstLogin) {
      return "/change-password";
    }

    return user.role === "ADMIN" ? "/dashboard" : "/external-training";
  }, [accessToken, user, firstLogin]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await loginRequest(email, password);

      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        firstLogin: data.firstLogin,
        user: data.user
      });

      if (data.firstLogin) {
        navigate("/change-password", { replace: true });
      } else if (data.role === "ADMIN") {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/external-training", { replace: true });
      }
    } catch {
      setErrorMessage("로그인에 실패했습니다. 이메일/비밀번호를 확인하세요.");
    } finally {
      setLoading(false);
    }
  }

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h1 className="text-2xl font-bold">EMS Login</h1>

        <label className="block space-y-1">
          <span className="text-sm">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        {googleError ? <p className="text-sm text-red-600">{googleError}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-900 text-white px-3 py-2 disabled:opacity-60"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <div className="flex items-center gap-3">
          <hr className="flex-1 border-slate-200" />
          <span className="text-xs text-slate-400">또는</span>
          <hr className="flex-1 border-slate-200" />
        </div>

        <button
          type="button"
          onClick={() => { window.location.href = `${API_BASE_URL}/auth/google`; }}
          className="w-full rounded border border-slate-300 bg-white text-slate-700 px-3 py-2 flex items-center justify-center gap-2 hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google 계정으로 로그인
        </button>
      </form>
    </div>
  );
}
