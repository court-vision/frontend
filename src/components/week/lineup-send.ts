/**
 * Sending the tray's staged moves to ESPN, one day after another, and what a
 * send reads again once it is over.
 *
 * ESPN keeps one lineup per day, and an edit carries forward to later days
 * until the next day that has its own edit. So days go earliest first, and a
 * day after the first write is read again before its own write: an earlier
 * day's edit may have reached it, and the server checks every write against
 * the roster version of the lineup ESPN holds for that day now.
 *
 * Each day's write used to await a re-read of every later day of the week,
 * then refetch today's moves, the matchup and the roster, before the next day
 * went (which then read its own day again anyway). Reconstructed from the
 * 2026-10-07 prod logs: a 1-day send took ~1.9 s server-side plus three browser
 * round trips, a 3-day tray send ~6 s with ~30 ESPN reads. Now a write only
 * caches the board the server returns (its re-read of that day after the
 * write), the next day is read once, and the re-reads go out in one wave after
 * the last day without holding the send up. Against a fake API with the Week
 * desk's reads mounted, that 3-day send went from 34 requests (30 ESPN lineup
 * reads) to 13 (15).
 */
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { lineupKeys } from "@/hooks/useLineupEditor";
import { matchupKeys } from "@/hooks/useMatchup";
import { teamsKeys } from "@/hooks/useTeams";
import { staleLineup } from "@/lib/lineup-editor";
import type { ApplyLineupMovesData, ApplyLineupMovesRequest, LineupMove, LineupState } from "@/types/lineup-editor";

/** One day's write as it came back: the server's read of that day after it, and whether it shows every move. */
export type SentDay = Pick<ApplyLineupMovesData, "lineup" | "verified">;

type Period = Pick<LineupState, "scoring_period_id" | "current_scoring_period_id">;

/** A day after ESPN's today: its board is cached under `lineupKeys.day`, today's under `lineupKeys.state`. */
function isLaterDay(board: Period): boolean {
  return board.current_scoring_period_id != null && board.scoring_period_id !== board.current_scoring_period_id;
}

/** The ESPN day a `lineupKeys.day(teamId, period)` key reads. */
const periodOfKey = (key: QueryKey): number => key[3] as number;

/** Put a board where the desk reads its day from. */
function cacheLineup(queryClient: QueryClient, teamId: number, board: LineupState) {
  if (!isLaterDay(board)) queryClient.setQueryData(lineupKeys.state(teamId), board);
  else if (board.scoring_period_id != null) queryClient.setQueryData(lineupKeys.day(teamId, board.scoring_period_id), board);
}

/**
 * Write one day's moves against `board` and cache the board the write returns.
 * Reads nothing again: whoever sends calls `settleLineupWrites` once, after its
 * last day. Rejects with the API error; a stale board (409 ROSTER_STALE) is
 * cached first.
 */
export async function writeLineupDay(
  queryClient: QueryClient,
  teamId: number,
  post: (body: ApplyLineupMovesRequest) => Promise<ApplyLineupMovesData>,
  board: LineupState,
  moves: LineupMove[]
): Promise<SentDay> {
  const period = board.scoring_period_id;
  if (period == null) throw new Error("This day can't be edited");
  let data: ApplyLineupMovesData;
  try {
    data = await post({ moves, expected_scoring_period_id: period, roster_version: board.roster_version });
  } catch (err) {
    const fresh = staleLineup(err);
    if (fresh) cacheLineup(queryClient, teamId, fresh);
    throw err;
  }
  // A read of this day or a later one that went out before the write answers with
  // the lineup from before it: landing after the board below, it would put the old
  // lineup back on screen, and the send's next read would join it instead of
  // reading again. Call those off; the reads after the send go out fresh.
  await queryClient.cancelQueries({ queryKey: lineupKeys.days(teamId), predicate: (q) => periodOfKey(q.queryKey) >= period });
  if (!isLaterDay(data.lineup)) await queryClient.cancelQueries({ queryKey: lineupKeys.state(teamId), exact: true });
  cacheLineup(queryClient, teamId, data.lineup);
  return { lineup: data.lineup, verified: data.verified };
}

/**
 * After a send, once and without waiting on it: read again what its writes may
 * have changed. `sent` is every day written, `failed` the error that stopped the
 * send, if one did.
 *
 * - Later days from the first day written on. A write reaches its own day and the
 *   days after it, never one before. A board a write returned verified is the
 *   server's read of that day after its write, and no later day's write reaches
 *   back to it, so it stays; an unverified one may be the lineup from before the
 *   write and is read again. A stale board means the lineups moved on ESPN some
 *   other way: every later day is read again, as before.
 * - Today's board after a later day's write, and everything else that shows the
 *   roster (today's moves, the matchup, insights, the roster), as each write did.
 */
export function settleLineupWrites(queryClient: QueryClient, teamId: number, sent: SentDay[], failed?: unknown) {
  const stale = failed !== undefined && staleLineup(failed) !== null;
  if (sent.length === 0 && !stale) return;
  const periods = sent.map((s) => s.lineup.scoring_period_id).filter((p): p is number => p != null);
  const from = stale || periods.length === 0 ? -Infinity : Math.min(...periods);
  const kept = new Set(stale ? [] : sent.filter((s) => s.verified && isLaterDay(s.lineup)).map((s) => s.lineup.scoring_period_id));
  void queryClient.invalidateQueries({
    queryKey: lineupKeys.days(teamId),
    predicate: (q) => {
      const period = periodOfKey(q.queryKey);
      return period >= from && !kept.has(period);
    },
  });
  if (sent.length === 0) return;
  if (sent.some((s) => isLaterDay(s.lineup))) void queryClient.invalidateQueries({ queryKey: lineupKeys.state(teamId) });
  queryClient.removeQueries({ queryKey: lineupKeys.plan(teamId) });
  void queryClient.invalidateQueries({ queryKey: lineupKeys.actions(teamId) });
  void queryClient.invalidateQueries({ queryKey: teamsKeys.insights(teamId) });
  void queryClient.invalidateQueries({ queryKey: teamsKeys.roster(teamId) });
  void queryClient.invalidateQueries({ queryKey: matchupKeys.live(teamId) });
  void queryClient.invalidateQueries({ queryKey: matchupKeys.week(teamId) });
}

/** A day the tray sends: its index in the week, and its name for what the send says. */
export interface SendStep {
  day: number;
  label: string;
}

export interface SendIo {
  /** The board the desk holds for a day when the send began. */
  board: (day: number) => LineupState | undefined;
  /** The moves a day still needs against a board: what is staged on it, less what the board already has. */
  moves: (day: number, board: LineupState) => LineupMove[];
  /** Write one day (`writeLineupDay`). */
  apply: (day: number, board: LineupState, moves: LineupMove[]) => Promise<SentDay>;
  /** Read a day's lineup again; null when it can't be read. */
  refresh: (day: number) => Promise<LineupState | null>;
  /** The one wave of re-reads after the send (`settleLineupWrites`). */
  settle: (sent: SentDay[], failed?: unknown) => void;
  /** The day going out now, then null when the send is over. */
  onSending?: (day: number | null) => void;
  /** A day done: written, or nothing left to send once read again. */
  onDone?: (day: number) => void;
}

export interface SendResult<T extends SendStep> {
  /** The days done, in order. */
  done: T[];
  /** The day that stopped the send and why; null when every day went. */
  failed: { step: T; error: unknown } | null;
}

/**
 * Send `steps` (earliest first), stopping at the first day that fails: a
 * write ESPN or the server refuses, or a read that doesn't come back. The days
 * before it stay written, and the re-reads go out after it all the same.
 */
export async function sendLineupDays<T extends SendStep>(steps: T[], io: SendIo): Promise<SendResult<T>> {
  const written: SentDay[] = [];
  const done: T[] = [];
  let failed: SendResult<T>["failed"] = null;
  try {
    for (const step of steps) {
      io.onSending?.(step.day);
      try {
        // An earlier day's write may have carried into this day: read it again.
        let b = io.board(step.day);
        if (written.length > 0) b = (await io.refresh(step.day)) ?? b;
        if (!b) continue;
        const moves = io.moves(step.day, b);
        if (moves.length > 0) written.push(await io.apply(step.day, b, moves));
      } catch (error) {
        failed = { step, error };
        break;
      }
      done.push(step);
      io.onDone?.(step.day);
    }
  } finally {
    io.onSending?.(null);
    io.settle(written, failed?.error);
  }
  return { done, failed };
}
