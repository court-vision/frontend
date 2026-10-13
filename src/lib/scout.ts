/**
 * The Scout desk's model: what is open (the focus), which list shows beside
 * it (the lens), the stat window, and the arithmetic every sheet shares —
 * splits from a game log, the compare table, the finder's matching, the
 * calendar. Pure: no React, no fetching.
 */
import type { AvgStats, GameLog } from "@/types/player";
import type { RankingsPlayer, RankingsScope, RankingsScoring } from "@/types/rankings";
import type { ProjectionStats } from "@/types/scout";
import type { CategoryDef, ScoringFormat } from "@/types/scoring";
import type { TeamResponseData } from "@/types/team";
import { NBA_TEAMS, NBA_TEAM_BY_ABBREV, type NBATeamInfo } from "@/lib/nbaTeams";
import { lastGames } from "@/lib/statWindow";

// ---------------------------------------------------------------------------
// Focus: the one thing the sheet shows
// ---------------------------------------------------------------------------

export type MarketSection = "adds" | "drops" | "draft";

export const MARKET_SECTIONS: ReadonlyArray<{ id: MarketSection; label: string; title: string }> = [
  { id: "adds", label: "Adds", title: "Ownership rising over seven days" },
  { id: "drops", label: "Drops", title: "Ownership falling over seven days" },
  { id: "draft", label: "Draft market", title: "ESPN rank and ADP, now against a week ago" },
];

export type Focus =
  | { kind: "player"; id: number }
  | { kind: "team"; abbrev: string }
  /** One matchup of a night. */
  | { kind: "game"; date: string; gameId: string }
  /** One of the market's lists. */
  | { kind: "market"; section: MarketSection }
  /** A lens's own overview. */
  | { kind: "overview"; lens: Lens };

export function isMarketSection(v: unknown): v is MarketSection {
  return MARKET_SECTIONS.some((m) => m.id === v);
}

/**
 * The focus a URL names: `?p=<nba id>`, `?t=<abbrev>`, `?g=<date>:<game id>`,
 * `?m=<adds|drops|draft>`, `?o=<lens>`; nothing opens the board.
 */
export function focusFromSearch(search: URLSearchParams): Focus | null {
  const p = Number(search.get("p"));
  if (Number.isInteger(p) && p > 0) return { kind: "player", id: p };
  const t = search.get("t")?.trim().toUpperCase();
  if (t && NBA_TEAM_BY_ABBREV[t]) return { kind: "team", abbrev: t };
  const g = search.get("g")?.trim();
  if (g) {
    const i = g.indexOf(":");
    const date = i === -1 ? g : g.slice(0, i);
    const gameId = i === -1 ? "" : g.slice(i + 1);
    // An NBA game id, or the fallback "AWAY@HOME" for a game the schedule has no id for.
    if (isDate(date) && /^[A-Za-z0-9_@-]{1,40}$/.test(gameId)) return { kind: "game", date, gameId };
  }
  const m = search.get("m");
  if (isMarketSection(m)) return { kind: "market", section: m };
  const o = search.get("o");
  if (isLens(o)) return { kind: "overview", lens: o };
  return null;
}

export function focusToSearch(focus: Focus | null): string {
  if (!focus) return "";
  switch (focus.kind) {
    case "player":
      return `?p=${focus.id}`;
    case "team":
      return `?t=${focus.abbrev}`;
    case "game":
      return `?g=${focus.date}:${encodeURIComponent(focus.gameId)}`;
    case "market":
      return `?m=${focus.section}`;
    case "overview":
      return `?o=${focus.lens}`;
  }
}

export function focusKey(focus: Focus): string {
  switch (focus.kind) {
    case "player":
      return `player:${focus.id}`;
    case "team":
      return `team:${focus.abbrev}`;
    case "game":
      return `game:${focus.date}:${focus.gameId}`;
    case "market":
      return `market:${focus.section}`;
    case "overview":
      return `overview:${focus.lens}`;
  }
}

export function sameFocus(a: Focus | null, b: Focus | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return focusKey(a) === focusKey(b);
}

/** The lens a focus belongs to. */
export function lensOf(focus: Focus): Lens {
  switch (focus.kind) {
    case "player":
      return "pool";
    case "team":
      return "teams";
    case "game":
      return "slate";
    case "market":
      return "market";
    case "overview":
      return focus.lens;
  }
}

// ---------------------------------------------------------------------------
// Opening a player
// ---------------------------------------------------------------------------

/**
 * The players either side of row `at`: what an arrow-key flip from there
 * would open next, so their stats can be asked for before the key lands.
 */
export function flipNeighbours(rows: readonly Focus[], at: number): number[] {
  const ids: number[] = [];
  for (const i of [at + 1, at - 1]) {
    const f = rows[i];
    if (f?.kind === "player") ids.push(f.id);
  }
  return ids;
}

/** A player's name and team as some source has them; null where it doesn't know. */
export interface PlayerIdentity {
  name: string | null;
  team: string | null;
}

/**
 * The name and team a player sheet goes by. Stats win once they land (the
 * player dimension and his latest game). Until then a seed the page already
 * holds (his pool row, or an earlier visit) stands in, so the header shows at
 * once and the requests that need a name (the ESPN market line) or a team
 * (the schedule) start beside stats instead of after it. The profile's team
 * counts only once stats has answered without one: before a season it is
 * often his new team while stats and the pool still have the old one (147 of
 * 582 ranked players on 2026-10-13), and going by it first would fetch one
 * team's schedule and then the other's.
 */
export function sheetIdentity({
  stats,
  profile,
  seed,
  statsPending,
}: {
  stats: PlayerIdentity | null | undefined;
  profile: PlayerIdentity | null | undefined;
  seed: PlayerIdentity | null | undefined;
  statsPending: boolean;
}): PlayerIdentity {
  const name = stats?.name || profile?.name || seed?.name || null;
  const team = stats?.team || seed?.team || (statsPending ? null : profile?.team) || null;
  return { name, team };
}

// ---------------------------------------------------------------------------
// Lens: the list beside the sheet
// ---------------------------------------------------------------------------

export type Lens = "pool" | "teams" | "slate" | "market";

export const LENSES: ReadonlyArray<{ id: Lens; label: string; title: string; overview: string; overviewNote: string }> = [
  { id: "pool", label: "POOL", title: "Every ranked player, the way the rankings score them", overview: "Rankings", overviewNote: "the whole pool, scored and sorted" },
  { id: "teams", label: "TEAMS", title: "The thirty NBA teams", overview: "Standings", overviewNote: "both conferences, record and ratings" },
  { id: "slate", label: "SLATE", title: "A night of games, and who is scoring in them", overview: "Tracker", overviewNote: "the night's games as they run" },
  { id: "market", label: "MARKET", title: "Who is being added, dropped and drafted", overview: "Market", overviewNote: "adds, drops and the draft market" },
];

export function isLens(v: unknown): v is Lens {
  return LENSES.some((l) => l.id === v);
}

export function lensInfo(lens: Lens) {
  return LENSES.find((l) => l.id === lens) ?? LENSES[0];
}

export function nextLens(lens: Lens, step: 1 | -1): Lens {
  const i = LENSES.findIndex((l) => l.id === lens);
  return LENSES[(i + step + LENSES.length) % LENSES.length].id;
}

// ---------------------------------------------------------------------------
// Stat windows
// ---------------------------------------------------------------------------

export const WINDOWS = ["season", "l5", "l10", "l15", "l30"] as const;
export type Window = (typeof WINDOWS)[number];

export function windowLabel(window: Window): string {
  return window === "season" ? "SEASON" : window.toUpperCase();
}

export function nextWindow(window: Window, step: 1 | -1 = 1): Window {
  const i = WINDOWS.indexOf(window);
  return WINDOWS[(i + step + WINDOWS.length) % WINDOWS.length];
}

// ---------------------------------------------------------------------------
// Stat lines: one row of per-game numbers
// ---------------------------------------------------------------------------

export interface StatLine {
  gp: number;
  fpts: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg3m: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
  /** Percentages on a 0–100 scale, from makes over attempts; null without attempts. */
  fgPct: number | null;
  ftPct: number | null;
  fg3Pct: number | null;
}

export type StatKey = keyof StatLine;

export interface StatCol {
  key: StatKey;
  label: string;
  /** Decimal places. */
  digits: number;
  /** Which way is good, for the compare table and the deltas. */
  better: "high" | "low";
}

/** The line every player sheet, split and compare column shows, in this order. */
export const LINE_COLS: readonly StatCol[] = [
  { key: "fpts", label: "FPTS", digits: 1, better: "high" },
  { key: "min", label: "MIN", digits: 1, better: "high" },
  { key: "pts", label: "PTS", digits: 1, better: "high" },
  { key: "reb", label: "REB", digits: 1, better: "high" },
  { key: "ast", label: "AST", digits: 1, better: "high" },
  { key: "stl", label: "STL", digits: 1, better: "high" },
  { key: "blk", label: "BLK", digits: 1, better: "high" },
  { key: "tov", label: "TO", digits: 1, better: "low" },
  { key: "fg3m", label: "3PM", digits: 1, better: "high" },
  { key: "fgPct", label: "FG%", digits: 1, better: "high" },
  { key: "ftPct", label: "FT%", digits: 1, better: "high" },
];

function rate(makes: number, attempts: number): number | null {
  return attempts > 0 ? Math.round((makes / attempts) * 1000) / 10 : null;
}

/** Game logs in date order, oldest first, whatever order they arrived in. */
export function sortLogs(logs: readonly GameLog[]): GameLog[] {
  return [...logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Per-game averages over some games; rates come from totals, never from averaging percentages. */
export function averageLine(logs: readonly GameLog[]): StatLine | null {
  const n = logs.length;
  if (n === 0) return null;
  const sum = (k: keyof GameLog) => logs.reduce((acc, g) => acc + (Number(g[k]) || 0), 0);
  const per = (k: keyof GameLog) => Math.round((sum(k) / n) * 10) / 10;
  const fgm = sum("fgm");
  const fga = sum("fga");
  const ftm = sum("ftm");
  const fta = sum("fta");
  const fg3m = sum("fg3m");
  const fg3a = sum("fg3a");
  return {
    gp: n,
    fpts: per("fpts"),
    min: per("min"),
    pts: per("pts"),
    reb: per("reb"),
    ast: per("ast"),
    stl: per("stl"),
    blk: per("blk"),
    tov: per("tov"),
    fg3m: per("fg3m"),
    fgm: per("fgm"),
    fga: per("fga"),
    ftm: per("ftm"),
    fta: per("fta"),
    fgPct: rate(fgm, fga),
    ftPct: rate(ftm, fta),
    fg3Pct: rate(fg3m, fg3a),
  };
}

/** The API's window averages as a line (its rates are already 0–100, 0 meaning no attempts). */
export function lineFromAvg(a: AvgStats, gp: number): StatLine {
  return {
    gp,
    fpts: a.avg_fpts,
    min: a.avg_minutes,
    pts: a.avg_points,
    reb: a.avg_rebounds,
    ast: a.avg_assists,
    stl: a.avg_steals,
    blk: a.avg_blocks,
    tov: a.avg_turnovers,
    fg3m: a.avg_fg3m,
    fgm: a.avg_fgm,
    fga: a.avg_fga,
    ftm: a.avg_ftm,
    fta: a.avg_fta,
    fgPct: a.avg_fga > 0 ? a.avg_fg_pct : null,
    ftPct: a.avg_fta > 0 ? a.avg_ft_pct : null,
    fg3Pct: a.avg_fg3a > 0 ? a.avg_fg3_pct : null,
  };
}

/** The games a window covers, oldest first; the whole log for the season. */
export function lastGamesOf(logs: readonly GameLog[], window: Window): GameLog[] {
  return lastGames(sortLogs(logs), window);
}

export interface Split {
  window: Window;
  label: string;
  line: StatLine | null;
}

/** Season, L5, L10, L15 and L30 from one game log (oldest first); a window longer than the log is the whole log. */
export function splitLines(logs: readonly GameLog[]): Split[] {
  const sorted = sortLogs(logs);
  return WINDOWS.map((window) => ({
    window,
    label: windowLabel(window),
    line: averageLine(lastGames(sorted, window)),
  }));
}

/** "48.7" for a rate, "27.4" for a counting stat, "—" for nothing. */
export function fmtStat(value: number | null | undefined, digits: number = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

/** "+2.4" / "−1.1" / "0.0": a change in a per-game number. */
export function fmtDelta(value: number | null | undefined, digits: number = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs < 0.05) return (0).toFixed(digits);
  return `${value > 0 ? "+" : "−"}${abs.toFixed(digits)}`;
}

/** Is a change good news for this column? Null when it is no change. */
export function deltaSign(value: number | null | undefined, better: "high" | "low"): "up" | "down" | null {
  if (value == null || Math.abs(value) < 0.05) return null;
  return (value > 0) === (better === "high") ? "up" : "down";
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

/** The columns that hold the best value (all of them when tied); none when every value is missing. */
export function bestOf(values: ReadonlyArray<number | null | undefined>, better: "high" | "low"): Set<number> {
  let best: number | null = null;
  for (const v of values) {
    if (v == null || Number.isNaN(v)) continue;
    if (best === null || (better === "high" ? v > best : v < best)) best = v;
  }
  const out = new Set<number>();
  if (best === null) return out;
  values.forEach((v, i) => {
    if (v != null && !Number.isNaN(v) && v === best) out.add(i);
  });
  return out;
}

/** Percentiles: the top fifth is hot, the bottom fifth cold. */
export function tier(percentile: number): "hot" | "mid" | "cold" {
  if (percentile >= 80) return "hot";
  if (percentile <= 20) return "cold";
  return "mid";
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A real calendar date in `YYYY-MM-DD`: "2026-02-31" is not one. */
export function isDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

/** "Thu". */
export function dow(iso: string): string {
  return DOWS[utc(iso).getUTCDay()];
}

/** "Oct 8". */
export function monthDay(iso: string): string {
  const d = utc(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Thu Oct 8", "Today", "Tomorrow", "Yesterday". */
export function dayName(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return `${dow(iso)} ${monthDay(iso)}`;
}

/** The slate's day strip: a few days back, a week ahead. */
export function slateDates(today: string, before: number = 3, after: number = 7): string[] {
  const out: string[] = [];
  for (let i = -before; i <= after; i++) out.push(addDays(today, i));
  return out;
}

/** Years old on `today`; null without a birthdate. */
export function ageOn(birthdate: string | null | undefined, today: string): number | null {
  if (!birthdate || !isDate(birthdate) || !isDate(today)) return null;
  const b = utc(birthdate);
  const t = utc(today);
  let age = t.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    t.getUTCMonth() < b.getUTCMonth() || (t.getUTCMonth() === b.getUTCMonth() && t.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

/**
 * What the finder makes of a date-like query: "today", "tonight", "tomorrow",
 * "yesterday", a weekday ("fri" = the next Friday, today included), "10/20",
 * "10/20/26" or an ISO date. Null for anything else.
 */
export function parseDateQuery(q: string, today: string): string | null {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  if (s === "today" || s === "tonight") return today;
  if (s === "tomorrow" || s === "tmrw") return addDays(today, 1);
  if (s === "yesterday" || s === "last night") return addDays(today, -1);
  if (isDate(s)) return s;
  const md = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(s);
  if (md) {
    const year = md[3] ? (md[3].length === 2 ? 2000 + Number(md[3]) : Number(md[3])) : Number(today.slice(0, 4));
    const iso = `${year}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
    return isDate(iso) ? iso : null;
  }
  if (s.length >= 3) {
    const full = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const idx = full.findIndex((d) => d.startsWith(s));
    if (idx >= 0) {
      const todayDow = utc(today).getUTCDay();
      return addDays(today, (idx - todayDow + 7) % 7);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Finder matching
// ---------------------------------------------------------------------------

/** Lower-case, accents stripped: "Jokić" matches "jokic". */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Teams whose abbreviation, city or name starts with the query. */
export function matchTeams(q: string, limit: number = 6): NBATeamInfo[] {
  const s = fold(q);
  if (s.length < 2) return [];
  const score = (t: NBATeamInfo): number => {
    const abbrev = t.abbrev.toLowerCase();
    if (abbrev === s) return 0;
    if (abbrev.startsWith(s)) return 1;
    const words = fold(t.name).split(" ");
    if (words.some((w) => w.startsWith(s))) return 2;
    if (fold(t.name).startsWith(s)) return 2;
    return -1;
  };
  return NBA_TEAMS.map((t) => ({ t, s: score(t) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.t.abbrev.localeCompare(b.t.abbrev))
    .slice(0, limit)
    .map((x) => x.t);
}

/** Ranked players whose name (or team) matches, best match first, then by rank. */
export function matchPool(q: string, pool: readonly RankingsPlayer[], limit: number = 8): RankingsPlayer[] {
  const s = fold(q);
  if (!s) return [];
  const score = (p: RankingsPlayer): number => {
    const name = fold(p.player_name);
    if (name.startsWith(s)) return 0;
    const words = name.split(" ");
    if (words.some((w) => w.startsWith(s))) return 1;
    if (name.includes(s)) return 2;
    // "jj" for Jalen Johnson, "sga" for Shai Gilgeous-Alexander
    const initials = name
      .split(/[\s-]+/)
      .map((w) => w[0] ?? "")
      .join("");
    if (initials === s) return 3;
    if (p.team.toLowerCase() === s) return 4;
    return -1;
  };
  return pool
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.p.rank - b.p.rank)
    .slice(0, limit)
    .map((x) => x.p);
}

/**
 * The directory's answer as it applies to what is typed now. An answer to
 * this very term is the server's, whole. An answer to an earlier term (kept
 * on screen while the new one is asked for) keeps only the names that still
 * contain the term, the server's own test, so a narrowing search never shows
 * a name the new answer wouldn't.
 */
export function directoryMatches<P extends { name: string }>(answer: { query: string; players: P[] } | null | undefined, q: string): P[] {
  const term = q.trim();
  if (!answer || term.length < 2) return [];
  if (answer.query === term) return answer.players;
  const s = fold(term);
  return answer.players.filter((p) => fold(p.name).includes(s));
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

/** "PT05M23.00S" → "5:23"; "PT00M00.00S" → "0:00"; anything else as given. */
export function clockText(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^PT(?:(\d+)M)?(?:(\d+)(?:\.\d+)?S)?$/.exec(iso);
  if (!m) return iso;
  const min = Number(m[1] ?? 0);
  const sec = Number(m[2] ?? 0);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

/** "Q3", "OT", "2OT". */
export function periodName(period: number | null | undefined): string {
  if (!period || period < 1) return "";
  if (period <= 4) return `Q${period}`;
  return period === 5 ? "OT" : `${period - 4}OT`;
}

/** "19:30" → "7:30 PM". */
export function tipText(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

export type GameState = "scheduled" | "live" | "final";

export function gameState(status: string | number | null | undefined): GameState {
  if (typeof status === "number") return status >= 3 ? "final" : status === 2 ? "live" : "scheduled";
  const s = (status ?? "").toLowerCase();
  if (s === "final" || s === "finished" || s === "complete") return "final";
  if (s === "in_progress" || s === "live" || s === "in progress") return "live";
  return "scheduled";
}

/** What to print beside a game: the tip, the period and clock, or Final. */
export function gameStatusText(
  status: string | number | null | undefined,
  period: number | null | undefined,
  clock: string | null | undefined,
  startEt: string | null | undefined
): string {
  const state = gameState(status);
  if (state === "final") return period && period > 4 ? `Final/${periodName(period)}` : "Final";
  if (state === "live") {
    const c = clockText(clock);
    if (period && period <= 4 && c === "0:00" && period === 2) return "Half";
    return `${periodName(period)} ${c}`.trim() || "Live";
  }
  return startEt ? `${tipText(startEt)} ET` : "TBD";
}

// ---------------------------------------------------------------------------
// Projection vs actual
// ---------------------------------------------------------------------------

export interface ProjectionRow {
  key: string;
  label: string;
  projected: number | null;
  actual: number | null;
  delta: number | null;
  better: "high" | "low";
  digits: number;
}

const PROJ_COLS: ReadonlyArray<{ key: keyof ProjectionStats; line: StatKey; label: string; better: "high" | "low"; rate?: boolean }> = [
  { key: "min", line: "min", label: "MIN", better: "high" },
  { key: "pts", line: "pts", label: "PTS", better: "high" },
  { key: "reb", line: "reb", label: "REB", better: "high" },
  { key: "ast", line: "ast", label: "AST", better: "high" },
  { key: "stl", line: "stl", label: "STL", better: "high" },
  { key: "blk", line: "blk", label: "BLK", better: "high" },
  { key: "tov", line: "tov", label: "TO", better: "low" },
  { key: "fg3m", line: "fg3m", label: "3PM", better: "high" },
  { key: "fg_pct", line: "fgPct", label: "FG%", better: "high", rate: true },
  { key: "ft_pct", line: "ftPct", label: "FT%", better: "high", rate: true },
];

/** ESPN's preseason per-game line beside the season so far (projection rates are 0–1 on the wire). */
export function projectionRows(projection: ProjectionStats, actual: StatLine | null): ProjectionRow[] {
  return PROJ_COLS.map((c) => {
    const raw = projection[c.key];
    const projected = raw == null ? null : c.rate ? Math.round(raw * 1000) / 10 : raw;
    const act = actual ? (actual[c.line] as number | null) : null;
    return {
      key: c.key,
      label: c.label,
      projected,
      actual: act,
      delta: projected != null && act != null ? Math.round((act - projected) * 10) / 10 : null,
      better: c.better,
      digits: 1,
    };
  });
}

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------

export type PoolSort = "rank" | "fpts" | "gp" | "change" | "name";

/** Positions a pool row can be filtered by; "G-F" counts as both. */
export type PosFilter = "ALL" | "G" | "F" | "C";

export function hasPosition(position: string | null | undefined, filter: PosFilter): boolean {
  if (filter === "ALL") return true;
  if (!position) return false;
  return position.toUpperCase().split(/[-/]/).includes(filter);
}

export function sortPool(rows: readonly RankingsPlayer[], sort: PoolSort): RankingsPlayer[] {
  const out = [...rows];
  switch (sort) {
    case "fpts":
      return out.sort((a, b) => b.avg_fpts - a.avg_fpts || a.rank - b.rank);
    case "gp":
      return out.sort((a, b) => (b.gp ?? 0) - (a.gp ?? 0) || a.rank - b.rank);
    case "change":
      return out.sort((a, b) => b.rank_change - a.rank_change || a.rank - b.rank);
    case "name":
      return out.sort((a, b) => a.player_name.localeCompare(b.player_name));
    default:
      return out.sort((a, b) => a.rank - b.rank);
  }
}

/** The pool filtered by a typed query (name, team, initials) and a position, in the given order. */
export function filterPool(rows: readonly RankingsPlayer[], q: string, pos: PosFilter, sort: PoolSort): RankingsPlayer[] {
  const byPos = rows.filter((r) => hasPosition(r.position, pos));
  if (!q.trim()) return sortPool(byPos, sort);
  const matched = matchPool(q, byPos, byPos.length);
  return sort === "rank" ? matched : sortPool(matched, sort);
}

// ---------------------------------------------------------------------------
// The pool's score: the platform's points, 9-cat, or one of your leagues
// ---------------------------------------------------------------------------

export type PoolScore = ScoringFormat | "league";

export function poolScore(scope: RankingsScope, format: ScoringFormat): PoolScore {
  return scope === "league" ? "league" : format;
}

/** A league the pool can be scored by. The route is per team, so it names the team it asks through. */
export interface LeagueChoice {
  /** One per league and format: two teams in one league score the pool alike, unless one previews another format. */
  key: string;
  teamId: number;
  league: string;
  team: string;
  /** "PTS", "CATS", "ROTO"; "PTS?" until the league's settings have been read. */
  tag: string;
  /** Read as roto, which rankings don't score yet: the backend ranks it by points, and a roto league has no point values. */
  roto: boolean;
  /** The categories the team plays: its league's, or the standard nine for a categories preview; none for points. */
  categories: CategoryDef[];
}

function leagueKey(t: TeamResponseData): string {
  const info = t.league_info;
  // A preview on a team with no league row yet comes back as league 0, which is no league's id.
  const league = t.league?.id ? `id:${t.league.id}` : `${info?.provider ?? "espn"}:${info?.league_id ?? `team${t.team_id}`}:${info?.year ?? ""}`;
  // The summary's type already has the team's scoring preview applied.
  return t.league ? `${league}:${t.league.scoring_type}` : league;
}

function choiceLeagueName(t: TeamResponseData): string {
  const n = (t.league?.name ?? t.league_info?.league_name ?? "").trim();
  if (n && n.toUpperCase() !== "N/A") return n;
  return t.league_info?.league_id != null ? `League ${t.league_info.league_id}` : "League";
}

function choiceTag(t: TeamResponseData): string {
  const l = t.league;
  if (!l?.settings_synced) return "PTS?";
  return l.scoring_type === "categories" ? "CATS" : l.scoring_type === "roto" ? "ROTO" : "PTS";
}

function choiceOf(t: TeamResponseData, key: string): LeagueChoice {
  const roto = !!t.league?.settings_synced && t.league.scoring_type === "roto";
  return { key, teamId: t.team_id, league: choiceLeagueName(t), team: t.league_info?.team_name?.trim() || `Team ${t.team_id}`, tag: choiceTag(t), roto, categories: t.league?.categories ?? [] };
}

/**
 * One choice per league among the user's teams, in the teams' order. A league
 * asks through its first team, or through the selected team when that is one
 * of its own, so picking it doesn't move the Week desk to another team.
 */
export function leagueChoices(teams: readonly TeamResponseData[], selected: number | null = null): LeagueChoice[] {
  const out: LeagueChoice[] = [];
  for (const t of teams) {
    const key = leagueKey(t);
    const at = out.findIndex((c) => c.key === key);
    if (at < 0) out.push(choiceOf(t, key));
    else if (t.team_id === selected) out[at] = choiceOf(t, key);
  }
  return out;
}

/** The league the pool is scored by: the selected team's, else the first team's. */
export function leagueChoiceFor(teams: readonly TeamResponseData[], selected: number | null): LeagueChoice | null {
  const choices = leagueChoices(teams, selected);
  return choices.find((c) => c.teamId === selected) ?? choices[0] ?? null;
}

/** A roto league's pool, ranked by the platform's points formula rather than anything of the league's. */
function rotoAsPoints(scoring: RankingsScoring | null | undefined, roto: boolean): boolean {
  return roto && !!scoring && scoring.basis !== "categories";
}

/** What produced the pool's numbers, in a word or two. `roto`: the chosen league is roto. */
export function basisLabel(scoring: RankingsScoring | null | undefined, roto = false): string {
  switch (scoring?.basis) {
    case "categories":
      return scoring.league_name ? "league categories" : "9-cat z-scores";
    case "league_points":
      return roto ? "fantasy points" : "league points";
    default:
      return "fantasy points";
  }
}

/** The league named as having scored the pool, or null: none did, or (roto) its numbers aren't the league's. */
export function scoredBy(scoring: RankingsScoring | null | undefined, roto = false): string | null {
  return scoring?.league_name && !rotoAsPoints(scoring, roto) ? scoring.league_name : null;
}

/**
 * Why a league's numbers aren't quite its own (short, and the long form), or
 * null when they are. `league` is the chosen league, `ranked` the categories
 * the ranking used (`meta.categories`).
 */
export function scoringWarning(
  scoring: RankingsScoring | null | undefined,
  league: Pick<LeagueChoice, "roto" | "categories"> | null = null,
  ranked: readonly CategoryDef[] = []
): { short: string; long: string } | null {
  if (rotoAsPoints(scoring, !!league?.roto)) {
    return { short: "roto · platform points", long: "Roto isn't supported for rankings yet, so the pool is ranked by the platform's points formula." };
  }
  if (!scoring || scoring.league_id == null) return null;
  if (scoring.settings_synced === false) {
    return { short: "settings unread · standard scoring", long: "Couldn't read the league's settings from the provider, so the pool is scored the standard way." };
  }
  if (scoring.unsupported.length) {
    const keys = scoring.unsupported.map((k) => k.toUpperCase()).join(", ");
    return { short: `${keys} left out`, long: `${keys} can't be scored from per-game averages, so the ranking leaves ${scoring.unsupported.length === 1 ? "it" : "them"} out.` };
  }
  // A category ranking drops the league's categories it can't rank from stored
  // stats (DD, A/TO, …) without naming them in `unsupported`, and ranks the
  // standard nine when that leaves none.
  const missing = scoring.basis === "categories" && league && ranked.length ? league.categories.filter((c) => !ranked.some((r) => r.key === c.key)) : [];
  if (missing.length && missing.length === league?.categories.length) {
    return { short: "standard 9-cat", long: "None of the league's categories can be ranked from the stored stats, so the pool is ranked by the standard nine." };
  }
  if (missing.length) {
    const labels = missing.map((c) => c.label).join(", ");
    return { short: `${labels} left out`, long: `${labels} can't be ranked from the stored stats, so the ranking leaves ${missing.length === 1 ? "it" : "them"} out.` };
  }
  return null;
}

/** "Jr." and friends dropped, first name to an initial: "N. Jokić". */
export function shortName(name: string): string {
  const suffixes = new Set(["JR", "JR.", "SR", "SR.", "II", "III", "IV", "V"]);
  const parts = name.split(" ").filter(Boolean);
  while (parts.length > 2 && suffixes.has(parts[parts.length - 1].toUpperCase())) parts.pop();
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

/** 23.4 → "23.4%", null → "—". Ownership and other whole-scale percentages. */
export function fmtPct(value: number | null | undefined, digits: number = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/** A percentage that may arrive as a 0–1 fraction (team stats, projections) or already 0–100. */
export function asPercent(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.abs(value) <= 1 ? Math.round(value * 1000) / 10 : value;
}

/** Team info for an abbreviation the API may spell differently from our table. */
export function teamInfo(abbrev: string | null | undefined): NBATeamInfo | null {
  if (!abbrev) return null;
  return NBA_TEAM_BY_ABBREV[abbrev.toUpperCase()] ?? null;
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface StandingRow {
  abbrev: string;
  name: string;
  conference: string;
  w: number;
  l: number;
  pct: number;
  /** Games behind the conference leader. */
  gb: number;
  net: number | null;
  off: number | null;
  def: number | null;
  pace: number | null;
  pts: number | null;
}

/** Teams ordered by winning percentage, games behind measured from each conference's leader. */
export function standings(
  rows: ReadonlyArray<{ abbrev: string; name: string; conference: string; w: number | null; l: number | null; net: number | null; off: number | null; def: number | null; pace: number | null; pts: number | null }>
): Record<"East" | "West", StandingRow[]> {
  const out: Record<"East" | "West", StandingRow[]> = { East: [], West: [] };
  for (const r of rows) {
    const w = r.w ?? 0;
    const l = r.l ?? 0;
    const conf: "East" | "West" = /west/i.test(r.conference) ? "West" : "East";
    out[conf].push({ abbrev: r.abbrev, name: r.name, conference: conf, w, l, pct: w + l > 0 ? w / (w + l) : 0, gb: 0, net: r.net, off: r.off, def: r.def, pace: r.pace, pts: r.pts });
  }
  for (const conf of ["East", "West"] as const) {
    const list = out[conf].sort((a, b) => b.pct - a.pct || b.w - a.w || (b.net ?? -99) - (a.net ?? -99) || a.abbrev.localeCompare(b.abbrev));
    const lead = list[0];
    for (const r of list) r.gb = lead ? Math.max(0, (lead.w - r.w + (r.l - lead.l)) / 2) : 0;
  }
  return out;
}

/** ".646" the way standings print it. */
export function fmtPctDot(p: number): string {
  return p.toFixed(3).replace(/^0/, "");
}

/** The night a game belongs to and its id, as a focus. */
export function gameFocus(date: string, gameId: string | null | undefined, away: string, home: string): Focus {
  return { kind: "game", date, gameId: gameId || `${away}@${home}` };
}
