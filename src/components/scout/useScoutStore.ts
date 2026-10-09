"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { focusKey, sameFocus, type Focus, type Lens, type PoolSort, type PosFilter, type Window } from "@/lib/scout";
import type { RankingsWindow } from "@/types/rankings";
import type { ScoringFormat } from "@/types/scoring";

export const MAX_PINNED = 8;
const MAX_RECENT = 10;

export interface PoolConfig {
  format: ScoringFormat;
  span: RankingsWindow;
  pos: PosFilter;
  sort: PoolSort;
}

interface ScoutStore {
  lens: Lens;
  window: Window;
  /** How the pool is scored and shown: the rankings board's controls. */
  pool: PoolConfig;
  /** Players and teams kept on the bench, oldest first. */
  pinned: Focus[];
  /** What was opened lately, newest first. */
  recent: Focus[];
  setLens: (lens: Lens) => void;
  setWindow: (window: Window) => void;
  setPool: (patch: Partial<PoolConfig>) => void;
  togglePin: (focus: Focus) => void;
  unpin: (focus: Focus) => void;
  clearPins: () => void;
  remember: (focus: Focus) => void;
}

const pinnable = (f: Focus) => f.kind === "player" || f.kind === "team";

/**
 * What the Scout desk remembers per browser: the list showing, the stat
 * window, the pool's controls, the bench and the recently opened. The focus
 * itself lives in the URL, so a link opens what it names.
 */
export const useScoutStore = create<ScoutStore>()(
  persist(
    (set) => ({
      lens: "pool",
      window: "season",
      pool: { format: "points", span: null, pos: "ALL", sort: "rank" },
      pinned: [],
      recent: [],
      setLens: (lens) => set({ lens }),
      setWindow: (window) => set({ window }),
      setPool: (patch) => set((s) => ({ pool: { ...s.pool, ...patch } })),
      togglePin: (focus) =>
        set((s) => {
          if (!pinnable(focus)) return s;
          if (s.pinned.some((p) => sameFocus(p, focus))) return { pinned: s.pinned.filter((p) => !sameFocus(p, focus)) };
          return { pinned: [...s.pinned, focus].slice(-MAX_PINNED) };
        }),
      unpin: (focus) => set((s) => ({ pinned: s.pinned.filter((p) => !sameFocus(p, focus)) })),
      clearPins: () => set({ pinned: [] }),
      remember: (focus) =>
        set((s) => {
          if (focus.kind === "overview") return s;
          return { recent: [focus, ...s.recent.filter((r) => focusKey(r) !== focusKey(focus))].slice(0, MAX_RECENT) };
        }),
    }),
    {
      name: "cv.scout",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lens: s.lens, window: s.window, pool: s.pool, pinned: s.pinned, recent: s.recent }),
      // v2 changed the focus shapes (a night became an overview); anything older is dropped.
      migrate: (persisted, version) => {
        const st = (persisted ?? {}) as Partial<ScoutStore>;
        if (version < 2) return { lens: st.lens ?? "pool", window: st.window ?? "season", pool: { format: "points", span: null, pos: "ALL", sort: "rank" }, pinned: [], recent: [] };
        return st;
      },
      // Rehydrated by the page after mount: the server renders the defaults, and so must the first client render.
      skipHydration: true,
    }
  )
);
