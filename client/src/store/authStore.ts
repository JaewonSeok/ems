import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AuthUser } from "../types/auth";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  firstLogin: boolean;
  user: AuthUser | null;
  setSession: (payload: {
    accessToken: string;
    refreshToken: string;
    firstLogin: boolean;
    user: AuthUser;
  }) => void;
  updateTokens: (payload: { accessToken: string; refreshToken?: string }) => void;
  setFirstLogin: (value: boolean) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      firstLogin: false,
      user: null,
      setSession: ({ accessToken, refreshToken, firstLogin, user }) =>
        set({ accessToken, refreshToken, firstLogin, user }),
      updateTokens: ({ accessToken, refreshToken }) =>
        set((state) => ({
          accessToken,
          refreshToken: refreshToken ?? state.refreshToken
        })),
      setFirstLogin: (value) => set({ firstLogin: value }),
      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          firstLogin: false,
          user: null
        })
    }),
    {
      name: "ems-auth",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
