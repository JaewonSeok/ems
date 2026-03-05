import { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

type ProtectedRouteProps = {
  adminOnly?: boolean;
  children?: ReactNode;
};

export default function ProtectedRoute({ adminOnly = false, children }: ProtectedRouteProps) {
  const location = useLocation();
  const { accessToken, firstLogin, user } = useAuthStore();

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (firstLogin && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (adminOnly && user.role !== "ADMIN") {
    return <Navigate to="/external-training" replace />;
  }

  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
}
