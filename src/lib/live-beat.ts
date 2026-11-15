/**
 * Reading live stats just after they are written.
 *
 * The live pipeline writes tonight's box scores every 15 seconds on the clock
 * (cron-runner's live-stats job, at :00, :15, :30 and :45; a run takes about a
 * second). A screen that polls every 15 s on a timer of its own reads each
 * write anywhere from at once to 15 s after it landed: 7.5 s late on average,
 * so a stat the pipeline had within 15 s can be 30 s old on screen.
 *
 * The live answers say how old their newest write was when the server answered
 * (`live_age_ms`; the backend's core/live_age.py). Counting on from the moment
 * the answer arrived, the next write is due when that age reaches one tick, and
 * the next read is timed for a second after it. Both halves of the sum are
 * differences (the servers' clocks, then this one's own), so a viewer whose
 * clock is wrong reads at the same moment as everyone else.
 *
 *   on the beat   the newest write is under a tick old: read 1 s after the
 *                 next one is due;
 *   late          that read found nothing new (a slow run): ask again every
 *                 2 s, for 6 s;
 *   skipped       still nothing: one read a tick, at the same point in it (a
 *                 run that failed is followed by the next one on the clock);
 *   quiet         nothing written for 90 s: the games are over, or the
 *                 pipeline is down. No beat, and the screen's own slow timer.
 *
 * A read costs the server a table read (the Week matchup hands its provider
 * read back instead of repeating it: `readLiveMatchup`), so a late write costs
 * three small requests, not three ESPN reads.
 */

/** cron-runner's live-stats schedule: one write every 15 s while games are on. */
export const LIVE_TICK = 15_000;
/** How long after a write is due it is read: a run's writes land within about a second of each other. */
export const WRITE_MARGIN = 1_000;
/** A write that hasn't landed is asked for again this often... */
export const LATE_RETRY = 2_000;
/** ...for this long. Then the run was skipped, and the next one is waited for. */
export const LATE_FOR = 6_000;
/** With nothing written for this long there is no beat to read by. */
export const LIVE_QUIET = 90_000;
/** Never sooner than this, for a target a few milliseconds off. */
const MIN_WAIT = 250;

/**
 * When to read again, in ms from `now`; null with no beat to read by (the
 * caller's own timer then). `ageMs` is the answer's `live_age_ms`, `readAt`
 * when that answer arrived (ms, this clock), `now` this clock.
 *
 * Asked again before the time is up (TanStack re-arms its timer whenever a
 * query's state changes), it names the same moment: every branch counts down
 * to a point fixed by the write's age.
 */
export function liveReadMs(ageMs: number | null | undefined, readAt: number, now: number): number | null {
  if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 0 || !(readAt > 0)) return null;
  const age = ageMs + Math.max(0, now - readAt);
  if (age >= LIVE_QUIET) return null;
  // How far past the first read after the next write: negative while it is still to come.
  const past = age - (LIVE_TICK + WRITE_MARGIN);
  if (past < 0) return Math.max(MIN_WAIT, -past);
  const step = past < LATE_FOR ? LATE_RETRY : LIVE_TICK;
  return Math.max(MIN_WAIT, step - (past % step));
}

/** What `onLiveBeat` reads of a query: its answer, and when that arrived. */
interface Answered<T> {
  state: { data: T | undefined; dataUpdatedAt: number };
}

/**
 * A `refetchInterval` on the beat. `ageOf` picks the answer's `live_age_ms`;
 * `slow` is the timer while there is no beat (false for none).
 */
export function onLiveBeat<T>(ageOf: (data: T | undefined) => number | null | undefined, slow: number | false) {
  return (query: Answered<T>): number | false =>
    liveReadMs(ageOf(query.state.data), query.state.dataUpdatedAt, Date.now()) ?? slow;
}
