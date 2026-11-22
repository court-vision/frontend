"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LiveSort } from "@/lib/live-rankings";
import { focusKey, sameFocus, type Focus, type Lens, type PoolSort, type PosFilter, type Window } from "@/lib/scout";
import type { RankingsScope, RankingsWindow } from "@/types/rankings";
import type { ScoringFormat } from "@/types/scoring";

export const MAX_PINNED = 8;
const MAX_RECENT = 10;

/**
 * Which of Scout's two rankings the board shows. `season` ranks what players
 * have scored so far (a span of it, or a league's own scoring); `live` is
 * Court Vision's rest-of-season board, rebuilt every morning.
 */
export type PoolBoard = "season" | "live";

export interface PoolConfig {
  board: PoolBoard;
  /** `league`: scored by the signed-in user's league (which decides the format); `global`: by `format`. */
  scope: RankingsScope;
  /** The rest-of-season board reads this too: its two boards are the two formats. */
  format: ScoringFormat;
  span: RankingsWindow;
  pos: PosFilter;
  sort: PoolSort;
  /** The rest-of-season board's own order: it has moves and ESPN's rank where the other has games and averages. */
  liveSort: LiveSort;
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

const DEFAULT_POOL: PoolConfig = { board: "season", scope: "global", format: "points", span: null, pos: "ALL", sort: "rank", liveSort: "rank" };

/** What an older browser stored, brought up to this version: a control added since takes its default. */
export function migrateScout(persisted: unknown, version: number) {
  const st = (persisted ?? {}) as Partial<ScoutStore>;
  if (version < 2) return { lens: st.lens ?? "pool", window: st.window ?? "season", pool: DEFAULT_POOL, pinned: [], recent: [] };
  if (version < 3) return { ...st, pool: { ...DEFAULT_POOL, ...st.pool, scope: "global" as const } };
  if (version < 4) return { ...st, pool: { ...DEFAULT_POOL, ...st.pool } };
  return st;
}

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
      pool: DEFAULT_POOL,
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
      version: 4,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lens: s.lens, window: s.window, pool: s.pool, pinned: s.pinned, recent: s.recent }),
      // v2 changed the focus shapes (a night became an overview); anything older is dropped.
      // v3 added the pool's scope (the league score option).
      // v4 added the pool's board (the rest-of-season rankings) and its sort.
      migrate: migrateScout,
      // Rehydrated by the page after mount: the server renders the defaults, and so must the first client render.
      skipHydration: true,
    }
  )
);
