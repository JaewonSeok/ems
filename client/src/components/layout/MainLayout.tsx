import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logoutRequest } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";

const navItems = [
  { to: "/dashboard", label: "Dashboard", adminOnly: true },
  { to: "/external-training", label: "External Training" },
  { to: "/internal-training", label: "Internal Training" },
  { to: "/internal-lecture", label: "Internal Lecture" },
  { to: "/certification", label: "Certification" },
  { to: "/statistics", label: "Statistics" },
  { to: "/all-records", label: "All Records", adminOnly: true },
  { to: "/user-management", label: "User Management", adminOnly: true },
  { to: "/bulk-upload", label: "Bulk Upload", adminOnly: true },
  { to: "/change-password", label: "Change Password" }
];

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearSession, user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";

  async function onLogout() {
    try {
      await logoutRequest();
    } catch {
      // ignore API failures and clear local session
    } finally {
      clearSession();
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="bg-slate-900 text-slate-100 p-4">
        <h1 className="text-lg font-semibold mb-1">Education Management System</h1>
        <p className="text-xs text-slate-300 mb-4">{user?.name} ({user?.role})</p>

        <nav className="space-y-2">
          {navItems.filter((item) => !item.adminOnly || isAdmin).map((item) => {
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

        <button onClick={onLogout} className="w-full rounded px-3 py-2 mt-4 bg-red-700 hover:bg-red-600 text-sm">
          Logout
        </button>
      </aside>

      <main className="p-6 bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
