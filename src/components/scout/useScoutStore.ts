"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { focusKey, sameFocus, type Focus, type Lens, type Window } from "@/lib/scout";

export const MAX_PINNED = 8;
const MAX_RECENT = 10;

interface ScoutStore {
  lens: Lens;
  window: Window;
  /** Players and teams kept on the bench, oldest first. */
  pinned: Focus[];
  /** What was opened lately, newest first. */
  recent: Focus[];
  setLens: (lens: Lens) => void;
  setWindow: (window: Window) => void;
  togglePin: (focus: Focus) => void;
  unpin: (focus: Focus) => void;
  clearPins: () => void;
  remember: (focus: Focus) => void;
}

/**
 * What the Scout desk remembers per browser: the list showing, the stat
 * window, the bench and the recently opened. The focus itself lives in the
 * URL, so a link opens what it names.
 */
export const useScoutStore = create<ScoutStore>()(
  persist(
    (set) => ({
      lens: "pool",
      window: "season",
      pinned: [],
      recent: [],
      setLens: (lens) => set({ lens }),
      setWindow: (window) => set({ window }),
      togglePin: (focus) =>
        set((s) => {
          if (focus.kind === "slate") return s;
          if (s.pinned.some((p) => sameFocus(p, focus))) return { pinned: s.pinned.filter((p) => !sameFocus(p, focus)) };
          return { pinned: [...s.pinned, focus].slice(-MAX_PINNED) };
        }),
      unpin: (focus) => set((s) => ({ pinned: s.pinned.filter((p) => !sameFocus(p, focus)) })),
      clearPins: () => set({ pinned: [] }),
      remember: (focus) =>
        set((s) => ({
          recent: [focus, ...s.recent.filter((r) => focusKey(r) !== focusKey(focus))].slice(0, MAX_RECENT),
        })),
    }),
    {
      name: "cv.scout",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lens: s.lens, window: s.window, pinned: s.pinned, recent: s.recent }),
      // Rehydrated by the page after mount: the server renders the defaults, and so must the first client render.
      skipHydration: true,
    }
  )
);
