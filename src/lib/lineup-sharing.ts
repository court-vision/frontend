/**
 * Structural sharing for lineup reads that looks past the server's read stamp.
 *
 * The server stamps every lineup it reads with the moment it read it
 * (`LineupState.fetched_at`, now on every read in the backend's
 * `lineup_read_service`), and today's moves carry the board they were worked
 * out against, stamp included. No two reads of the same lineup are ever equal,
 * so TanStack's own structural sharing hands back a new top-level object on
 * every poll and everything that follows the board's identity (the Week desk's
 * boards, every grid built from them, the market's ranking) is rebuilt whether
 * or not anything changed. Against a fake API that stamps each read the way the
 * server does, a poll of today's unchanged lineup with the market open cost
 * ~200 ms of rendering at 4x CPU throttle; with these, under 1 ms.
 *
 * These keep the cached object when a read differs from it only in that stamp.
 * Nothing on the desk reads `fetched_at` (the query's own `dataUpdatedAt` says
 * when it was last read), so the cached copy keeping its first stamp is
 * harmless. Any other change is shared as TanStack shares it: the new object
 * carries the new stamp, and unchanged players keep their objects.
 */
import { replaceEqualDeep } from "@tanstack/react-query";
import type { DailyActionsData } from "@/types/daily-actions";
import type { LineupState } from "@/types/lineup-editor";

/** `prev` itself when `next` matches it once `pin` has copied prev's stamp into it; otherwise TanStack's sharing. */
function shareBesides<T>(prev: unknown, next: unknown, pin: (next: T, prev: T) => T): unknown {
  if (prev != null && next != null && typeof prev === "object" && typeof next === "object") {
    if (replaceEqualDeep(prev, pin(next as T, prev as T)) === prev) return prev;
  }
  return replaceEqualDeep(prev, next);
}

/** `structuralSharing` for a lineup read (`GET /teams/{id}/lineup`, any day). */
export function shareLineup(prev: unknown, next: unknown): unknown {
  return shareBesides<LineupState>(prev, next, (n, p) => ({ ...n, fetched_at: p.fetched_at }));
}

/** `structuralSharing` for today's moves (`GET /teams/{id}/actions`), whose `lineup` is a fresh read each time. */
export function shareActions(prev: unknown, next: unknown): unknown {
  return shareBesides<DailyActionsData>(prev, next, (n, p) =>
    n.lineup && p.lineup ? { ...n, lineup: { ...n.lineup, fetched_at: p.lineup.fetched_at } } : n
  );
}
