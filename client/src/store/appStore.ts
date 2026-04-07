import { create } from "zustand";

type AppState = {
  appName: string;
  setAppName: (name: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
  appName: "LMS",
  setAppName: (name) => set({ appName: name })
}));
