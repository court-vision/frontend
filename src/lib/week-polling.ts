/**
 * When the Week desk reads again on its own.
 *
 * A live-matchup poll that reads the provider is a full ESPN league read plus
 * a valuation of both rosters on the server, every lineup poll an ESPN roster
 * read, and today's moves two ESPN reads and three valuations. Polled all day
 * at full speed, one open tab made ~120 live, ~60 lineup and ~12 moves reads an
 * hour, preseason included, while nothing they show can change between games
 * but a move made on ESPN (and coming back to the tab reads those again).
 *
 * So each poll runs at full speed only around the games it is about:
 *
 *   live    while rostered box scores are being written, a second after each
 *           write (every 15 s: `liveReadMs`), the provider read under them
 *           repeated only every other time (`readLiveMatchup`); with no write
 *           to read by, every 30 s from 15 min before your first tip until
 *           30 min after your last and whenever a rostered player's box score
 *           (either side) says his game is on; 5 min otherwise (opponent moves
 *           and ESPN's overnight settlement still show up);
 *   lineup  from 15 min before your first tip until just after your last one
 *           locks, while the board is writable; 10 min otherwise, so a board
 *           left open past ESPN's 2 AM rollover still moves to the new day;
 *   moves   that same window at 5 min; 15 min otherwise.
 *
 * Off-window delays never overshoot a window: the read before one is timed to
 * land as it opens. Tip times are ET wall times on the board's NBA date.
 *
 * Only your tips are on the desk: the week's row for today carries box scores,
 * not the opponent's tip times. So a game where only the opponent has a player
 * (and every game of a Yahoo team, which has no board) speeds the live poll up
 * once its first box score is live, up to one slow read (5 min) after the tip.
 * Opening the window at the slate's first tip instead kept every matinee day
 * fast from the early tip on: 49 of the season's 156 game days tip before
 * 18:00 ET, 38 before 16:00, hours before most evening games.
 */
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { liveReadMs } from "@/lib/live-beat";
import { etInstant } from "@/lib/local-time";
import type { LineupState } from "@/types/lineup-editor";
import type { LiveMatchupData } from "@/types/matchup";

const MINUTE = 60_000;

export { etInstant };

/** The live poll around rostered games while no box score write is there to read by (`liveReadMs`). */
export const LIVE_FAST = 30_000;
export const LIVE_SLOW = 5 * MINUTE;
export const LINEUP_FAST = MINUTE;
export const LINEUP_SLOW = 10 * MINUTE;
export const ACTIONS_FAST = 5 * MINUTE;
export const ACTIONS_SLOW = 15 * MINUTE;
/** Polling speeds up this long before a tip. */
export const TIP_LEAD = 15 * MINUTE;
/** The live poll stays fast this long after the last tip it knows; live box scores carry it after that. */
export const TIP_TAIL = 30 * MINUTE;
/** A lineup is read once more after the last lock (each player locks at his tip). */
export const LOCK_TAIL = 2 * MINUTE;
/** Never schedule a read sooner than this, for a window that is about to open. */
const MIN_WAIT = 5_000;

/** A stretch of time, as instants (ms). */
export interface Span {
  start: number;
  end: number;
}

/** Your players' tips on the board's day (each one locks his spot). */
export function lockTimes(board: LineupState | null | undefined): number[] {
  if (!board?.nba_date) return [];
  const out: number[] = [];
  for (const p of board.players) {
    if (!p.has_game_today) continue;
    const at = etInstant(board.nba_date, p.game_time_et);
    if (at != null) out.push(at);
  }
  return out;
}

/**
 * When the live matchup polls fast by the clock: from 15 min before your first
 * tip to 30 min after your last. Null with no board or none of yours playing
 * that day; the opponent's games are caught by their box scores (`gameOn`).
 */
export function liveSpan(board: LineupState | null | undefined): Span | null {
  const locks = lockTimes(board);
  if (locks.length === 0) return null;
  return { start: Math.min(...locks) - TIP_LEAD, end: Math.max(...locks) + TIP_TAIL };
}

/** From 15 min before your first tip to just after your last one has locked; null when none of yours plays. */
export function lockSpan(board: LineupState | null | undefined): Span | null {
  const locks = lockTimes(board);
  if (locks.length === 0) return null;
  return { start: Math.min(...locks) - TIP_LEAD, end: Math.max(...locks) + LOCK_TAIL };
}

/** A rostered player's game is on, by the live box scores (the server already ages out a stuck "live"). */
export function gameOn(live: LiveMatchupData | null | undefined): boolean {
  if (!live) return false;
  return [...live.your_team.roster, ...live.opponent_team.roster].some((p) => p.live?.game_status === 2);
}

/** `fast` inside the span; outside it `slow`, but never past the span's start. */
function pace(span: Span | null, now: number, fast: number, slow: number): number {
  if (!span) return slow;
  if (now >= span.start && now <= span.end) return fast;
  if (now < span.start) return Math.max(MIN_WAIT, Math.min(slow, span.start - now));
  return slow;
}

/**
 * The live matchup's next read, in ms. `readAt` is when `live` arrived: with
 * it, and rostered box scores being written, the read lands a second after the
 * next write (`liveReadMs`).
 */
export function livePollMs(span: Span | null, live: LiveMatchupData | null | undefined, now: number, readAt: number = 0): number {
  const beat = liveReadMs(live?.live_age_ms, readAt, now);
  if (beat != null) return beat;
  if (gameOn(live)) return LIVE_FAST;
  return pace(span, now, LIVE_FAST, LIVE_SLOW);
}

/**
 * One read of the live matchup, for the query at `queryKey`.
 *
 * The answer is the provider's rosters (an ESPN or Yahoo league read and a
 * valuation, on the server) with tonight's box scores on top. The box scores
 * are written every 15 s; the rosters change when somebody makes a move. So a
 * desk that holds an answer hands back its `provider_read_ms`, and the server
 * may put fresh box scores over the provider read it made for that answer, for
 * up to 25 s (the backend's services/matchup_hold.py): on the 15 s beat the
 * provider is read every other time, as often as before.
 *
 * Nothing is handed back once something has asked for the matchup again: a
 * move's re-reads invalidate the query, and its rosters must then come from
 * the provider (a poll or a return to the tab does not invalidate it). A
 * re-read that arrives while a read over the old rosters is on its way joins
 * that read, so when it lands the provider is read after all.
 */
export async function readLiveMatchup(
  queryClient: QueryClient,
  queryKey: QueryKey,
  read: (reuseFrom: number | undefined) => Promise<LiveMatchupData>
): Promise<LiveMatchupData> {
  const held = queryClient.getQueryState<LiveMatchupData>(queryKey);
  const reuseFrom = held?.isInvalidated ? undefined : (held?.data?.provider_read_ms ?? undefined);
  const data = await read(reuseFrom);
  if (reuseFrom !== undefined && queryClient.getQueryState(queryKey)?.isInvalidated) return read(undefined);
  return data;
}

/** Today's lineup's next read, in ms; false for a board that can't be written (nothing to keep current). */
export function lineupPollMs(board: LineupState | null | undefined, now: number): number | false {
  if (!board?.can_write) return false;
  return pace(lockSpan(board), now, LINEUP_FAST, LINEUP_SLOW);
}

/** Today's moves' next read, in ms. */
export function actionsPollMs(board: LineupState | null | undefined, now: number): number {
  return pace(lockSpan(board), now, ACTIONS_FAST, ACTIONS_SLOW);
}
