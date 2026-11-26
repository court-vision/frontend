import { create } from "zustand";

/** A question is only good for the trip to the AI desk: after this it is dropped unasked. */
const ASK_TTL_MS = 60_000;

interface DimeAsk {
  pending: { teamId: number; message: string; at: number } | null;
  /** A question typed outside the AI desk (the Home desk's ask line), for the team it is about. */
  put: (teamId: number, message: string, now?: number) => void;
  /** The question waiting for this team, handed over once; null when there is none or it is stale. */
  take: (teamId: number | null, now?: number) => string | null;
}

/**
 * The hand-off of a question to Dime from another desk: the desk puts it here and opens the AI
 * desk, which takes it and asks it in a new conversation. Never stored: a reload drops it.
 */
export const useDimeAsk = create<DimeAsk>()((set, get) => ({
  pending: null,
  put: (teamId, message, now = Date.now()) => set({ pending: { teamId, message, at: now } }),
  take: (teamId, now = Date.now()) => {
    const p = get().pending;
    if (!p || p.teamId !== teamId) return null;
    set({ pending: null });
    return now - p.at <= ASK_TTL_MS ? p.message : null;
  },
}));
