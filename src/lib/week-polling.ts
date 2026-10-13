/**
 * When the Week desk reads again on its own.
 *
 * Every live-matchup poll is a full ESPN league read plus a valuation of both
 * rosters on the server, every lineup poll an ESPN roster read, and today's
 * moves two ESPN reads and three valuations. Polled all day at full speed, one
 * open tab made ~120 live, ~60 lineup and ~12 moves reads an hour, preseason
 * included, while nothing they show can change between games but a move made
 * on ESPN (and coming back to the tab reads those again).
 *
 * So each poll runs at full speed only around the games it is about:
 *
 *   live    from 15 min before the slate's first tip until 30 min after the
 *           last tip of yours it knows, and whenever a rostered player's box
 *           score says his game is on; 5 min otherwise (opponent moves and
 *           ESPN's overnight settlement still show up);
 *   lineup  from 15 min before your first tip until just after your last one
 *           locks, while the board is writable; 10 min otherwise, so a board
 *           left open past ESPN's 2 AM rollover still moves to the new day;
 *   moves   that same window at 5 min; 15 min otherwise.
 *
 * Off-window delays never overshoot a window: the read before one is timed to
 * land as it opens. Tip times are ET wall times on the board's NBA date; only
 * an ESPN team has a board, so a Yahoo team's live poll speeds up once its
 * first box score is live.
 */
import type { LineupState } from "@/types/lineup-editor";
import type { LiveMatchupData, WeeklyMatchupData } from "@/types/matchup";

const MINUTE = 60_000;

/** cron-runner's live-stats job writes box scores every 30 s while games are on. */
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

const ET = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

/** The ET wall clock at `ms`, read back as if it were UTC. */
function etWall(ms: number): number {
  const p = Object.fromEntries(ET.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
}

/** The instant of an ET wall time ("19:30") on a date ("2026-10-20"); null when either is unreadable. */
export function etInstant(date: string | null | undefined, hhmm: string | null | undefined): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  const t = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  if (!d || !t) return null;
  const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  // ET is UTC−5 or UTC−4: guess the first, then correct by how far that instant's ET clock is off.
  const guess = wall + 5 * 60 * MINUTE;
  return guess + (wall - etWall(guess));
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
 * Does anyone in the matchup play on the board's day? Yours from the board,
 * both sides from the week's row for that day; a day the week doesn't hold
 * counts as a game day when the slate has games (the opponent may play).
 */
function anyonePlays(board: LineupState, week: WeeklyMatchupData | null | undefined): boolean {
  if (board.players.some((p) => p.has_game_today)) return true;
  const day = week?.days.find((d) => d.date === board.nba_date);
  if (!day) return board.first_game_time_et != null;
  const rows = [...day.your_team.roster, ...day.opponent_team.roster] as Array<{ had_game?: boolean; has_game?: boolean }>;
  return rows.some((p) => !!(p.had_game ?? p.has_game));
}

/**
 * When the live matchup polls fast by the clock: from 15 min before the
 * slate's first tip (it comes before any rostered player's) to 30 min after
 * the latest tip known (the slate's first or one of yours). Null with no
 * board, no tip times, or nobody in the matchup playing that day.
 */
export function liveSpan(board: LineupState | null | undefined, week: WeeklyMatchupData | null | undefined): Span | null {
  if (!board?.nba_date || !anyonePlays(board, week)) return null;
  const locks = lockTimes(board);
  const slate = etInstant(board.nba_date, board.first_game_time_et);
  const tips = slate != null ? [slate, ...locks] : locks;
  if (tips.length === 0) return null;
  return { start: Math.min(...tips) - TIP_LEAD, end: Math.max(...tips) + TIP_TAIL };
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

/** The live matchup's next read, in ms. */
export function livePollMs(span: Span | null, live: LiveMatchupData | null | undefined, now: number): number {
  if (gameOn(live)) return LIVE_FAST;
  return pace(span, now, LIVE_FAST, LIVE_SLOW);
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
