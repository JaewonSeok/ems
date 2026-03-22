import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AuthUser } from "../types/auth";

type ImpersonationState = {
  targetUser: AuthUser | null;
  startImpersonation: (user: AuthUser) => void;
  stopImpersonation: () => void;
};

export const useImpersonationStore = create<ImpersonationState>()(
  persist(
    (set) => ({
      targetUser: null,
      startImpersonation: (user) => set({ targetUser: user }),
      stopImpersonation: () => set({ targetUser: null }),
    }),
    {
      name: "ems-impersonation",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
