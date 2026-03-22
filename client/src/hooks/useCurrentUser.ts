import { useAuthStore } from "../store/authStore";
import { useImpersonationStore } from "../store/impersonationStore";

export function useCurrentUser() {
  const realUser = useAuthStore((state) => state.user);
  const targetUser = useImpersonationStore((state) => state.targetUser);

  const isAdmin = realUser?.role === "ADMIN";
  const isImpersonating = isAdmin && targetUser !== null;
  const effectiveUser = isImpersonating ? targetUser : realUser;

  return { effectiveUser, realUser, isAdmin, isImpersonating };
}
