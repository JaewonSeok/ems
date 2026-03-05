import { FormEvent, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { loginRequest } from "../api/auth";
import { useAuthStore } from "../store/authStore";

export default function Login() {
  const navigate = useNavigate();
  const { accessToken, user, firstLogin, setSession } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-900 text-white px-3 py-2 disabled:opacity-60"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
