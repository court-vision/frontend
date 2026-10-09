"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { EMPTY_CANVAS, type Canvas } from "@/lib/sqlmate-query";

export interface HistoryEntry {
  id: number;
  at: number;
  opId: string | null;
  method: string;
  url: string;
  status: number | null;
  ms: number;
  values: Record<string, string>;
  body: string | null;
}

const MAX_HISTORY = 20;

interface DevStore {
  /** Playground requests, newest first. */
  history: HistoryEntry[];
  /** The query canvas, as left. */
  canvas: Canvas;
  remember: (entry: Omit<HistoryEntry, "id" | "at">) => void;
  clearHistory: () => void;
  setCanvas: (canvas: Canvas) => void;
}

/** What the developer desk keeps per browser: the playground's recent requests and the query canvas. Never a key. */
export const useDevStore = create<DevStore>()(
  persist(
    (set) => ({
      history: [],
      canvas: EMPTY_CANVAS,
      remember: (entry) =>
        set((st) => ({ history: [{ ...entry, id: Date.now(), at: Date.now() }, ...st.history].slice(0, MAX_HISTORY) })),
      clearHistory: () => set({ history: [] }),
      setCanvas: (canvas) => set({ canvas }),
    }),
    {
      name: "cv.dev",
      storage: createJSONStorage(() => localStorage),
      partialize: (st) => ({ history: st.history, canvas: st.canvas }),
      skipHydration: true,
    }
  )
);

/**
 * The API key the playground sends. Session storage only: it is gone when
 * the tab closes, and it never reaches the persisted store.
 */
const KEY_SLOT = "cv.dev.key";

interface KeyStore {
  key: string;
  setKey: (key: string) => void;
  load: () => void;
}

export const useSessionKey = create<KeyStore>()((set) => ({
  key: "",
  setKey: (key) => {
    try {
      if (key) sessionStorage.setItem(KEY_SLOT, key);
      else sessionStorage.removeItem(KEY_SLOT);
    } catch {
      // private mode: the key lives in memory for the page's life
    }
    set({ key });
  },
  load: () => {
    try {
      const k = sessionStorage.getItem(KEY_SLOT);
      if (k) set({ key: k });
    } catch {
      // nothing stored
    }
  },
}));
