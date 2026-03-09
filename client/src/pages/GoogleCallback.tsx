import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { AuthUser, UserRole } from "../types/auth";

export default function GoogleCallback() {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();

  useEffect(() => {
    const queryString = window.location.hash.split("?")[1];

    if (!queryString) {
      navigate("/login", { replace: true });
      return;
    }

    const params = new URLSearchParams(queryString);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const role = params.get("role") as UserRole | null;
    const firstLogin = params.get("firstLogin") === "true";
    const userId = params.get("userId") ?? "";
    const email = params.get("email") ?? "";
    const name = params.get("name") ?? "";

    if (!accessToken || !refreshToken) {
      navigate("/login", { replace: true });
      return;
    }

    const user: AuthUser = {
      id: userId,
      email,
      name,
      role: role ?? "USER",
      employee_id: "",
      department: "",
      team: "",
    };

    setSession({ accessToken, refreshToken, firstLogin, user });

    if (firstLogin) {
      navigate("/change-password", { replace: true });
    } else if (user.role === "ADMIN") {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/external-training", { replace: true });
    }
  }, [navigate, setSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-600">Google 로그인 처리 중...</p>
    </div>
  );
}
