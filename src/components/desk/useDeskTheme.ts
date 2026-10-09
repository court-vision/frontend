"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type DeskTheme = "dark" | "light";

interface DeskThemeStore {
  theme: DeskTheme;
  toggle: () => void;
  setTheme: (theme: DeskTheme) => void;
}

/** One theme for every desk, remembered per browser. Dark until storage says otherwise. */
export const useDeskTheme = create<DeskThemeStore>()(
  persist(
    (set) => ({
      theme: "dark",
      toggle: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "cv.desk.theme",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme }),
      // Rehydrated by the frame after mount: the server renders dark, and so must the first client render.
      skipHydration: true,
    }
  )
);
