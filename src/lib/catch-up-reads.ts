/**
 * Reading again a few seconds after a roster change.
 *
 * ESPN answers reads from a copy that can trail its writes. From 2026-11-06 to
 * 11-12, 8 of 38 lineup writes read back right after the write still showed the
 * lineup from before it; the write came back "not confirmed yet" with that old
 * board, the desk put it on screen, and nothing read it again until the next poll
 * (1 to 10 minutes), so the move only showed after a reload. The backend now
 * reads a write back until it shows (about 5 s at most), but a write it still
 * can't see comes back unconfirmed, and the reads the desk sends right after any
 * change (the later days, the matchup, the week) can hit that same trailing copy.
 *
 * So after a write the desk reads those again a few seconds on, and while a write
 * isn't confirmed it reads its board again as well, twice. A board a write came
 * back verified with is the server's read after the write and is never read
 * again here: a trailing copy could put the old lineup back over it.
 */
import type { InvalidateQueryFilters, QueryClient } from "@tanstack/react-query";

/** When the reads go again after a write: once after any, twice after one that isn't confirmed. Tests shorten them. */
export const catchUpDelays = {
  after: [3_000] as readonly number[],
  unconfirmed: [3_000, 10_000] as readonly number[],
};

const pending = new Map<number, Array<ReturnType<typeof setTimeout>>>();

/**
 * Read `filters` again after each of `delays` ms. A team's next write calls off
 * the reads still waiting from its last one (`cancelCatchUp`): its own re-reads
 * cover them, and one landing after it could carry the lineup from before it.
 * A read already in flight is joined, never called off: a send may be awaiting it.
 */
export function catchUp(
  queryClient: QueryClient,
  teamId: number,
  filters: readonly InvalidateQueryFilters[],
  delays: readonly number[]
) {
  cancelCatchUp(teamId);
  if (filters.length === 0 || delays.length === 0) return;
  const timers = delays.map((ms, i) =>
    setTimeout(() => {
      if (i === delays.length - 1) pending.delete(teamId);
      for (const f of filters) void queryClient.invalidateQueries(f, { cancelRefetch: false });
    }, ms)
  );
  pending.set(teamId, timers);
}

/** Call off a team's re-reads still waiting (a new write to it is going out). */
export function cancelCatchUp(teamId: number) {
  pending.get(teamId)?.forEach(clearTimeout);
  pending.delete(teamId);
}

/** Whether a team has re-reads waiting (for tests). */
export function catchUpPending(teamId: number): boolean {
  return pending.has(teamId);
}
