import { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

type ProtectedRouteProps = {
  adminOnly?: boolean;
  children?: ReactNode;
};

export default function ProtectedRoute({ adminOnly = false, children }: ProtectedRouteProps) {
  const { accessToken, user } = useAuthStore();

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "ADMIN") {
    return <Navigate to="/external-training" replace />;
  }

  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
}
