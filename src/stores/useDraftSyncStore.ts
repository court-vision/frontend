import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The one piece of ESPN-sync state that must outlive a reload: whether the user
 * has paused auto-recording — per room. Everything else about a sync (the
 * port, the connection status, the frame counts, the pick front) is ephemeral
 * and lives in the hook's reducer — a persisted port handle would be
 * meaningless and a persisted "connected" would be a lie on the next load.
 *
 * Pausing persists on purpose: someone who paused mid-draft and reloaded must
 * not silently resume recording picks the extension keeps streaming. It is
 * keyed by session so that pausing one room says nothing about the next: two
 * rooms are two independent syncs.
 */
interface DraftSyncStore {
  /** Session id → paused. Absent means running. */
  paused: Record<string, boolean>;
  setPaused: (sessionId: number, paused: boolean) => void;
}

export const useDraftSyncStore = create<DraftSyncStore>()(
  persist(
    (set) => ({
      paused: {},
      setPaused: (sessionId, paused) =>
        set((state) => {
          const next = { ...state.paused };
          if (paused) next[String(sessionId)] = true;
          else delete next[String(sessionId)];
          return { paused: next };
        }),
    }),
    {
      name: "draft-sync-store",
      version: 1,
      partialize: (state) => ({ paused: state.paused }),
      // v0 stored one global boolean; a per-room map starts clean.
      migrate: () => ({ paused: {} }),
    }
  )
);
