import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { changePasswordRequest } from "../api/auth";
import { useAuthStore } from "../store/authStore";

export default function ChangePassword() {
  const navigate = useNavigate();
  const { accessToken, user, firstLogin, setFirstLogin } = useAuthStore();
  const userRole = user?.role;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!accessToken || !userRole) {
    return <Navigate to="/login" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setErrorMessage("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await changePasswordRequest(newPassword, currentPassword || undefined);
      setFirstLogin(false);

      if (userRole === "ADMIN") {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/external-training", { replace: true });
      }
    } catch {
      setErrorMessage("비밀번호 변경에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h1 className="text-2xl font-bold">비밀번호 변경</h1>
        {firstLogin ? <p className="text-sm text-slate-600">첫 로그인입니다. 비밀번호를 변경해 주세요.</p> : null}

        <label className="block space-y-1">
          <span className="text-sm">현재 비밀번호 (첫 로그인 시 생략 가능)</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">새 비밀번호</span>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">새 비밀번호 확인</span>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-900 text-white px-3 py-2 disabled:opacity-60"
        >
          {loading ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </div>
  );
}
