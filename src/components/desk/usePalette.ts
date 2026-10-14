"use client";

import { useEffect, useId } from "react";
import { create } from "zustand";
import type { PaletteEntry } from "@/lib/palette";

/** One thing the command palette can do: a line to read, and what ⏎ does. */
export interface PaletteCommand extends PaletteEntry {
  id: string;
  icon?: React.ReactNode;
  /** A key that does the same on this desk, as the status line writes it ("T"). */
  keys?: string;
  /** Already so (the team in use, the theme showing): drawn with a check. */
  on?: boolean;
  run: () => void;
}

interface PaletteStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** What the mounted desk adds, by registration. */
  desk: Record<string, PaletteCommand[]>;
  register: (key: string, commands: PaletteCommand[]) => void;
  unregister: (key: string) => void;
}

/**
 * Whether the palette is open, and the commands the desk on screen adds to
 * it. A store rather than context so the bar's button, ⌘K and a desk can all
 * reach it without a provider between them.
 */
export const usePalette = create<PaletteStore>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  desk: {},
  register: (key, commands) => set((s) => ({ desk: { ...s.desk, [key]: commands } })),
  unregister: (key) =>
    set((s) => {
      const desk = { ...s.desk };
      delete desk[key];
      return { desk };
    }),
}));

/**
 * A desk's own commands, listed first in the palette while the desk is on
 * screen. Memoize `commands`: each new array is a new registration.
 */
export function useDeskCommands(commands: PaletteCommand[]): void {
  const key = useId();
  const register = usePalette((s) => s.register);
  const unregister = usePalette((s) => s.unregister);
  useEffect(() => {
    register(key, commands);
    return () => unregister(key);
  }, [key, commands, register, unregister]);
}
