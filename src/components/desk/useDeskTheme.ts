"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_DARK, DEFAULT_LIGHT, isDeskTheme, themePair, themeScheme, type DeskScheme, type DeskThemeId } from "./themes";

export type { DeskScheme, DeskThemeId } from "./themes";

interface DeskThemeStore {
  theme: DeskThemeId;
  setTheme: (id: DeskThemeId) => void;
  /** Light to dark and back, within the theme's pair. */
  toggle: () => void;
}

/** One theme for every desk, remembered per browser. Paper until storage says otherwise. */
export const useDeskTheme = create<DeskThemeStore>()(
  persist(
    (set) => ({
      theme: DEFAULT_LIGHT,
      setTheme: (id) => set({ theme: id }),
      toggle: () => set((s) => ({ theme: themePair(s.theme) })),
    }),
    {
      name: "cv.desk.theme",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme }),
      // Version 0 stored "dark" | "light", the first desk palettes: keep the side, take its new theme.
      migrate: (stored, version) => {
        const theme = (stored as { theme?: unknown } | null)?.theme;
        if (version === 0) return { theme: theme === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT };
        return { theme };
      },
      // A theme that no longer exists falls back to the default.
      merge: (stored, current) => {
        const theme = (stored as { theme?: unknown } | null)?.theme;
        return { ...current, theme: isDeskTheme(theme) ? theme : current.theme };
      },
      // Rehydrated by the frame after mount: the server renders the default, and so must the first client render.
      skipHydration: true,
    }
  )
);

export function useDeskScheme(): DeskScheme {
  return themeScheme(useDeskTheme((s) => s.theme));
}
