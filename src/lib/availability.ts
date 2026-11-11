/**
 * Our availability verdicts on the Week desk (the news plan's step 6).
 *
 * data-platform's availability pipeline keeps one verdict per player per game
 * date (nba.player_availability): out, doubtful, questionable, probable or
 * available, with the source that decided it. The desk asks for the matchup's
 * two rosters over today and the days left (`verdictAsk`), and `withVerdicts`
 * lays the answer over the week's games:
 *
 *   - a game not yet tipped is out exactly when our verdict says out, whatever
 *     ESPN's status string says; a player we hold no verdict on keeps ESPN's;
 *   - every game we hold a verdict on carries it as its `ruling`, which the
 *     grid's tooltip spells out with its source and time (`gridCellTitle`);
 *   - today's verdict becomes the player's status word, so the strip beside
 *     his name agrees with his cell.
 *
 * Past days stay on their box scores: the verdicts are not read for them.
 */
import type { Verdict, VerdictWord } from "@/types/availability";
import { localClock, localDate, localWeekdayTime } from "./local-time";
import { isOutStatus, type DayGame, type GridCell, type Ruling, type WeekSource } from "./week-grid";
import { weekDaysFromApi, type SourceInputs } from "./week-source";

/** How many players and days one read may name (the route's own limits). */
export const MAX_VERDICT_PLAYERS = 60;
export const MAX_VERDICT_DAYS = 14;

/** The source that decided a verdict, in words (the backend's `decided_by`). */
export const SOURCE_WORDS: Record<string, string> = {
  nba_report: "the NBA injury report",
  nba_boxscore: "the NBA box score",
  espn_injuries: "ESPN's injury list",
  espn_fantasy: "ESPN fantasy",
  news: "the news",
};

const VERDICT_WORDS: Record<VerdictWord, string> = {
  out: "Out",
  doubtful: "Doubtful",
  questionable: "Questionable",
  probable: "Probable",
  available: "Available",
};

// Today's verdict as the status word the desk reads ESPN's in (`healthOf`, the name's title).
const STATUS_WORDS: Record<VerdictWord, string> = {
  out: "OUT",
  doubtful: "DOUBTFUL",
  questionable: "QUESTIONABLE",
  probable: "PROBABLE",
  available: "ACTIVE",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** What the desk asks for: these NBA ids, from `start` to `end` (ISO dates). */
export interface VerdictAsk {
  nbaIds: number[];
  start: string;
  end: string;
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * The verdicts the week needs: every player either roster names (today's board,
 * the later days' boards, the matchup's rows, the week's own days), over today
 * and the days left. Null when the week has no day left to play or names nobody
 * with an NBA id.
 */
export function verdictAsk({ week, live, matchup, board, boards }: SourceInputs): VerdictAsk | null {
  const ahead = weekDaysFromApi(week).filter((d) => d.kind !== "past");
  if (ahead.length === 0) return null;
  const ids = new Set<number>();
  const add = (id: number | null | undefined) => {
    if (id != null && id > 0) ids.add(id);
  };
  board?.players.forEach((p) => add(p.nba_player_id));
  boards?.forEach((b) => b?.players.forEach((p) => add(p.nba_player_id)));
  for (const rows of [live, matchup]) {
    rows?.your_team.roster.forEach((p) => add(p.nba_player_id));
    rows?.opponent_team.roster.forEach((p) => add(p.nba_player_id));
  }
  for (const d of week.days) {
    if (d.day_type === "past") continue;
    d.your_team.roster.forEach((p) => add(p.nba_player_id));
    d.opponent_team.roster.forEach((p) => add(p.nba_player_id));
  }
  if (ids.size === 0) return null;
  const start = ahead[0].date;
  const last = ahead[ahead.length - 1].date;
  const cap = addDays(start, MAX_VERDICT_DAYS - 1);
  return {
    nbaIds: [...ids].sort((a, b) => a - b).slice(0, MAX_VERDICT_PLAYERS),
    start,
    end: last < cap ? last : cap,
  };
}

function rulingOf(v: Verdict): Ruling {
  return {
    verdict: v.verdict,
    decidedBy: v.decided_by ?? null,
    reason: v.reason ?? null,
    expectedReturn: v.expected_return ?? null,
    changedAt: v.changed_at ?? null,
  };
}

/** Today's verdict as the player's status word; ESPN's own where it says out with more (SUSPENSION, INJURY_RESERVE). */
function statusOf(verdict: VerdictWord, espn: string | null): string {
  if (verdict === "out" && isOutStatus(espn)) return espn!;
  return STATUS_WORDS[verdict];
}

type Overlaid = { nbaId?: number | null; injury?: string | null; games: Array<DayGame | null> };

/** The week with our verdicts laid over its unplayed games (see the module's note). */
export function withVerdicts(source: WeekSource, verdicts: readonly Verdict[] | null | undefined): WeekSource {
  if (!verdicts?.length) return source;
  const byKey = new Map(verdicts.map((v) => [`${v.nba_player_id}|${v.game_date}`, v]));
  const today = source.todayIndex != null ? source.days[source.todayIndex]?.date ?? null : null;

  const overlay = <T extends Overlaid>(p: T): T => {
    if (p.nbaId == null) return p;
    let ruled = false;
    const games = p.games.map((g, i) => {
      const d = source.days[i];
      if (!g || !d || d.kind === "past") return g;
      const v = byKey.get(`${p.nbaId}|${d.date}`);
      if (!v) return g;
      ruled = true;
      return { ...g, out: g.status === "scheduled" && v.verdict === "out", ruling: rulingOf(v) };
    });
    const now = today != null ? byKey.get(`${p.nbaId}|${today}`) : undefined;
    if (!ruled && !now) return p;
    return { ...p, games, ...(now ? { injury: statusOf(now.verdict, p.injury ?? null) } : {}) };
  };

  return { ...source, mine: source.mine.map(overlay), opponents: source.opponents.map(overlay) };
}

function monthDay(iso: string): string | null {
  const [, m, d] = iso.split("-").map(Number);
  return m && d && MONTHS[m - 1] ? `${MONTHS[m - 1]} ${d}` : null;
}

/**
 * A verdict in words: "Out: Left Ankle; Sprain, back Nov 20 (ESPN's injury
 * list, 4:30 PM)". The time is when it last changed, in the viewer's zone,
 * with its weekday when that was not today.
 */
export function rulingTitle(r: Ruling, opts: { tz?: string; now?: number } = {}): string {
  const back = r.expectedReturn && r.verdict !== "available" ? monthDay(r.expectedReturn) : null;
  const why = [r.reason, back ? `back ${back}` : null].filter(Boolean).join(", ");
  const head = why ? `${VERDICT_WORDS[r.verdict]}: ${why}` : VERDICT_WORDS[r.verdict];
  const by = r.decidedBy ? SOURCE_WORDS[r.decidedBy] ?? r.decidedBy : null;
  const ms = r.changedAt ? Date.parse(r.changedAt) : NaN;
  let at: string | null = null;
  if (Number.isFinite(ms)) {
    const now = opts.now ?? Date.now();
    at = localDate(ms, opts.tz) === localDate(now, opts.tz) ? localClock(ms, { tz: opts.tz }) : localWeekdayTime(ms, { tz: opts.tz });
  }
  const tail = [by, at].filter(Boolean).join(", ");
  return tail ? `${head} (${tail})` : head;
}

const TAG_TITLES: Record<string, string> = {
  BENCH: "On the bench: this game doesn't count",
  SITS: "No room in the best lineup that day",
  IR: "On IR",
  DROP: "Leaves the roster: this game doesn't count",
};

/**
 * What a grid cell's styling means, for its tooltip (the grid itself carries no
 * status words), with our verdict on a game not yet played beside it.
 */
export function gridCellTitle(cell: GridCell, opts: { tz?: string; now?: number } = {}): string | undefined {
  const ruled = cell.ruling && (cell.state === "out" || cell.state === "upcoming") ? rulingTitle(cell.ruling, opts) : null;
  const tagged = cell.tag ? TAG_TITLES[cell.tag] : undefined;
  if (tagged) return ruled ? `${tagged} · ${ruled}` : tagged;
  if (cell.state === "out") return ruled ?? "Out for this game";
  if (cell.state === "dnp") return "Didn't play";
  return ruled ?? undefined;
}
