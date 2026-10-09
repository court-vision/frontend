"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_DARK, DEFAULT_LIGHT, isDeskTheme, themeScheme, type DeskScheme, type DeskThemeId } from "./themes";

export type { DeskScheme, DeskThemeId } from "./themes";

interface DeskThemeStore {
  theme: DeskThemeId;
  /** The last light and last dark pick: where T goes. */
  light: DeskThemeId;
  dark: DeskThemeId;
  setTheme: (id: DeskThemeId) => void;
  /** Light to dark and back, each side keeping its own pick. */
  toggle: () => void;
}

type Stored = Partial<Pick<DeskThemeStore, "theme" | "light" | "dark">>;

/** One theme for every desk, remembered per browser. */
export const useDeskTheme = create<DeskThemeStore>()(
  persist(
    (set) => ({
      theme: DEFAULT_DARK,
      light: DEFAULT_LIGHT,
      dark: DEFAULT_DARK,
      setTheme: (id) => set({ theme: id, [themeScheme(id)]: id }),
      toggle: () => set((s) => ({ theme: themeScheme(s.theme) === "dark" ? s.light : s.dark })),
    }),
    {
      name: "cv.desk.theme",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme, light: s.light, dark: s.dark }),
      // Version 0 stored only "dark" | "light": move it to the newer palettes, keeping its side.
      migrate: (stored, version) => {
        const s = (stored ?? {}) as Stored;
        if (version === 0) return { theme: s.theme === "light" ? DEFAULT_LIGHT : DEFAULT_DARK };
        return s;
      },
      // A theme that no longer exists falls back to its side's default.
      merge: (stored, current) => {
        const s = (stored ?? {}) as Stored;
        const light = isDeskTheme(s.light) ? s.light : current.light;
        const dark = isDeskTheme(s.dark) ? s.dark : current.dark;
        const theme = isDeskTheme(s.theme) ? s.theme : current.theme;
        return { ...current, theme, light, dark, [themeScheme(theme)]: theme };
      },
      // Rehydrated by the frame after mount: the server renders the default, and so must the first client render.
      skipHydration: true,
    }
  )
);

export function useDeskScheme(): DeskScheme {
  return themeScheme(useDeskTheme((s) => s.theme));
}
