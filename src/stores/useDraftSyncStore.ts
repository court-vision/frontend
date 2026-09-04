import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The one piece of ESPN-sync state that must outlive a reload: whether the user
 * has paused auto-recording. Everything else about a sync (the port, the
 * connection status, the frame counts, the pick front) is ephemeral and lives
 * in the hook's reducer — a persisted port handle would be meaningless and a
 * persisted "connected" would be a lie on the next load.
 *
 * Pausing persists on purpose: someone who paused mid-draft and reloaded must
 * not silently resume recording picks the extension keeps streaming.
 */
interface DraftSyncStore {
  paused: boolean;
  setPaused: (paused: boolean) => void;
}

export const useDraftSyncStore = create<DraftSyncStore>()(
  persist(
    (set) => ({
      paused: false,
      setPaused: (paused) => set({ paused }),
    }),
    {
      name: "draft-sync-store",
      partialize: (state) => ({ paused: state.paused }),
    }
  )
);
