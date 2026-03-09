import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AuthUser } from "../types/auth";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (payload: {
    accessToken: string;
    refreshToken: string;
    firstLogin?: boolean;
    user: AuthUser;
  }) => void;
  updateTokens: (payload: { accessToken: string; refreshToken?: string }) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),
      updateTokens: ({ accessToken, refreshToken }) =>
        set((state) => ({
          accessToken,
          refreshToken: refreshToken ?? state.refreshToken
        })),
      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null
        })
    }),
    {
      name: "ems-auth",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
