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
 * back verified with is the server's read after the write and isn't asked for
 * again (a trailing copy could put the old lineup back over it), unless an
 * unconfirmed write before it in the same send asked for it.
 */
import type { InvalidateQueryFilters, QueryClient } from "@tanstack/react-query";

/** When the reads go again after a write: once after any, twice after one that isn't confirmed. Tests shorten them. */
export const catchUpDelays = {
  after: [3_000] as readonly number[],
  unconfirmed: [3_000, 10_000] as readonly number[],
};

interface Pending {
  filters: InvalidateQueryFilters[];
  delays: readonly number[];
  timers: Array<ReturnType<typeof setTimeout>>;
}

const pending = new Map<number, Pending>();

/**
 * Read `filters` again after each of `delays` ms. Re-reads a team still has
 * waiting are kept and go with these, on the longer of the two schedules from
 * now: one send can make an add / drop and then lineup writes, each asking for
 * its own (an unconfirmed add / drop wants today's board and the market, a
 * confirmed lineup write after it doesn't), and the later ask must not drop the
 * earlier one's. A read already in flight is joined, never called off: a send
 * may be awaiting it.
 */
export function catchUp(
  queryClient: QueryClient,
  teamId: number,
  filters: readonly InvalidateQueryFilters[],
  delays: readonly number[]
) {
  const waiting = pending.get(teamId);
  waiting?.timers.forEach(clearTimeout);
  const all = [...(waiting?.filters ?? []), ...filters];
  const schedule = waiting && waiting.delays.length > delays.length ? waiting.delays : delays;
  if (all.length === 0 || schedule.length === 0) {
    pending.delete(teamId);
    return;
  }
  const timers = schedule.map((ms, i) =>
    setTimeout(() => {
      if (i === schedule.length - 1) pending.delete(teamId);
      for (const f of all) void queryClient.invalidateQueries(f, { cancelRefetch: false });
    }, ms)
  );
  pending.set(teamId, { filters: all, delays: schedule, timers });
}

/** Drop a team's re-reads still waiting (tests, between cases). */
export function cancelCatchUp(teamId: number) {
  pending.get(teamId)?.timers.forEach(clearTimeout);
  pending.delete(teamId);
}

/** Whether a team has re-reads waiting (for tests). */
export function catchUpPending(teamId: number): boolean {
  return pending.has(teamId);
}
