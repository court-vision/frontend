/**
 * The Team desk's arithmetic: your team against the league's other rosters, projected the same
 * way. Everything here is pure over the desk's three reads (src/types/team-desk.ts), so the desk
 * and its tests share it.
 */
import type {
  LeagueProjectionData,
  LeagueValuesData,
  MatchupBenchmark,
  PlayerWindowValue,
  TierBenchmark,
  ValueWindowKey,
} from "@/types/team-desk";

import { ordinal } from "@/lib/draft-recap";

export { ordinal };

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------

export interface WindowDef {
  key: ValueWindowKey;
  label: string;
  /** How a sentence names it: "over the next 4 matchups". */
  phrase: string;
}

export const WINDOWS: readonly WindowDef[] = [
  { key: "this_week", label: "This week", phrase: "this matchup" },
  { key: "next_4", label: "Next 4", phrase: "the next 4 matchups" },
  { key: "to_playoffs", label: "To playoffs", phrase: "the rest of the regular season" },
  { key: "playoffs", label: "Playoffs", phrase: "the playoffs" },
  { key: "rest_of_season", label: "Rest of season", phrase: "the rest of the season" },
];

/** The desk opens on the long view: the team as it stands for the season. */
export const DEFAULT_WINDOW: ValueWindowKey = "rest_of_season";

export function windowDef(key: ValueWindowKey): WindowDef {
  return WINDOWS.find((w) => w.key === key) ?? WINDOWS[WINDOWS.length - 1];
}

/** `?w=next_4` → its key; anything else → the default. */
export function windowFromParam(value: string | null | undefined): ValueWindowKey {
  return WINDOWS.find((w) => w.key === value)?.key ?? DEFAULT_WINDOW;
}

/** The streaming line solves a plan per matchup, so it reads four matchups at most (backend MAX_MATCHUPS). */
export const LINE_MAX_MATCHUPS = 4;

/**
 * The window the streaming line is read over for the desk's window: the same one when it is four
 * matchups or fewer, else the next four. `playoffMatchups` is the league's playoff matchups when
 * known (a league with more than four rounds is read over the next four too).
 */
export function lineWindow(key: ValueWindowKey, playoffMatchups: number | null): ValueWindowKey {
  if (key === "this_week" || key === "next_4") return key;
  if (key === "playoffs" && (playoffMatchups == null || playoffMatchups <= LINE_MAX_MATCHUPS)) return key;
  return "next_4";
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const MINUS = "−";

/** Points: whole above a thousand ("3,238"), a tenth below ("350.1"). */
export function pts(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const abs = Math.abs(v);
  const s = abs >= 1000 ? Math.round(abs).toLocaleString("en-US") : abs.toFixed(1);
  return v < 0 && s !== "0.0" ? `${MINUS}${s}` : s;
}

/** Signed points: "+19.6", "−11.7", "+1,204". */
export function signedPts(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const s = pts(Math.abs(v));
  if (s === "0.0") return "0.0";
  return v > 0 ? `+${s}` : `${MINUS}${s}`;
}

/** A share as a whole percent, under 1% and over 99% kept honest ("<1%", ">99%"). */
export function pct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "–";
  if (v > 0 && v < 0.005) return "<1%";
  if (v < 1 && v > 0.995) return ">99%";
  return `${Math.round(v * 100)}%`;
}

/** "Nov 27", or "Nov 27 – Dec 20" for a range (dates are ISO days, read as calendar days). */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function dayRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return dayLabel(end);
  if (!end || end === start) return dayLabel(start);
  const [a, b] = [dayLabel(start), dayLabel(end)];
  // Same month: "Nov 27–29"
  if (a.split(" ")[0] === b.split(" ")[0]) return `${a}–${b.split(" ")[1]}`;
  return `${a} – ${b}`;
}

/** "12/14" for a chart's axis. */
export function shortDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

/** "21–23", or "21" alone. */
export function matchupSpan(first: number, last: number): string {
  return first === last ? `${first}` : `${first}–${last}`;
}

// ---------------------------------------------------------------------------
// Ranking a number among the league's
// ---------------------------------------------------------------------------

export interface LeagueSpread {
  you: number;
  median: number;
  /** The playoff line: the Nth best, N the league's playoff spots. */
  line: number;
  best: number;
  worst: number;
  /** 1 = best. */
  rank: number;
  teams: number;
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (!n) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** `you` among every team's value (yours included); `higher` says which way is better. */
export function spread(you: number, all: number[], playoffTeams: number, higher = true): LeagueSpread {
  const better = (a: number, b: number) => (higher ? a > b + 1e-9 : a < b - 1e-9);
  const order = [...all].sort((a, b) => (higher ? b - a : a - b));
  const n = order.length;
  const at = Math.max(1, Math.min(n, playoffTeams || Math.ceil(n / 2)));
  return {
    you,
    median: median([...all].sort((a, b) => a - b)),
    line: order[at - 1] ?? you,
    best: order[0] ?? you,
    worst: order[n - 1] ?? you,
    rank: 1 + all.filter((v) => better(v, you)).length,
    teams: n,
  };
}

/** A rank's tone among `teams`: the top quarter is good news, the bottom quarter bad. */
export function rankTone(rank: number, teams: number): "up" | "down" | "flat" {
  const q = Math.max(1, Math.ceil(teams / 4));
  if (rank <= q) return "up";
  if (rank > teams - q) return "down";
  return "flat";
}

// ---------------------------------------------------------------------------
// Where your points come from: every roster's window, split the same way
// ---------------------------------------------------------------------------

export type TrackId = "lineup" | "guards" | "forwards" | "centers" | "bench" | "depth" | "missed";

export interface Track extends LeagueSpread {
  id: TrackId;
  label: string;
  /** Higher is better (false: fewer is better, so the track runs the other way). */
  higher: boolean;
  /** What the number is, for its title. */
  note: string;
}

type Group = "G" | "F" | "C";
const POSITION_GROUP: Record<string, Group> = { PG: "G", SG: "G", G: "G", SF: "F", PF: "F", F: "F", C: "C" };

/** A player's share of each position group: split evenly across the groups he's eligible at. */
export function groupShares(positions: readonly string[]): Partial<Record<Group, number>> {
  const groups = [...new Set(positions.map((p) => POSITION_GROUP[p]).filter(Boolean))] as Group[];
  if (!groups.length) return {};
  return Object.fromEntries(groups.map((g) => [g, 1 / groups.length]));
}

interface RosterSums {
  lineup: number;
  guards: number;
  forwards: number;
  centers: number;
  bench: number;
  depth: number;
  missed: number;
}

/** Each rostered team's sums over the window, by league team id. */
export function rosterSums(players: readonly PlayerWindowValue[], starters: number): Map<number, RosterSums> {
  const byTeam = new Map<number, PlayerWindowValue[]>();
  for (const p of players) {
    if (p.league_team_id == null) continue;
    const list = byTeam.get(p.league_team_id) ?? [];
    list.push(p);
    byTeam.set(p.league_team_id, list);
  }
  const out = new Map<number, RosterSums>();
  for (const [id, list] of byTeam) {
    const sums: RosterSums = { lineup: 0, guards: 0, forwards: 0, centers: 0, bench: 0, depth: 0, missed: 0 };
    for (const p of list) {
      const started = p.started ?? 0;
      sums.lineup += started;
      const shares = groupShares(p.positions);
      sums.guards += started * (shares.G ?? 0);
      sums.forwards += started * (shares.F ?? 0);
      sums.centers += started * (shares.C ?? 0);
      sums.bench += Math.max(p.value - started, 0);
      sums.missed += p.per_game * Math.max(p.team_games - p.games, 0);
    }
    const values = list.map((p) => p.value).sort((a, b) => b - a);
    sums.depth = values.slice(starters, starters + 3).reduce((s, v) => s + v, 0);
    out.set(id, sums);
  }
  return out;
}

/** The lineup's seats: every slot but the bench and IR (10 when the league's slots aren't known). */
export function startersOf(slots: Record<string, number> | null | undefined): number {
  if (!slots) return 10;
  const n = Object.entries(slots)
    .filter(([slot]) => slot !== "BE" && slot !== "IR")
    .reduce((s, [, count]) => s + count, 0);
  return n > 0 ? n : 10;
}

/**
 * Your team on each track against the league's rosters over the window. Null until your roster
 * is in the read.
 */
export function teamTracks(values: LeagueValuesData, opts: { starters: number; playoffTeams: number }): Track[] | null {
  const mineId = values.players.find((p) => p.mine)?.league_team_id;
  if (mineId == null) return null;
  const sums = rosterSums(values.players, opts.starters);
  const you = sums.get(mineId);
  if (!you) return null;
  const all = [...sums.values()];
  const first = opts.starters + 1;
  const defs: Array<{ id: TrackId; label: string; higher: boolean; note: string }> = [
    { id: "lineup", label: "Your lineup", higher: true, note: "What your lineup scores over the window, every seat filled best first each day" },
    { id: "guards", label: "From guards", higher: true, note: "Lineup points from guards (a player eligible at two groups counts half to each)" },
    { id: "forwards", label: "From forwards", higher: true, note: "Lineup points from forwards (a player eligible at two groups counts half to each)" },
    { id: "centers", label: "From centers", higher: true, note: "Lineup points from centers (a player eligible at two groups counts half to each)" },
    { id: "bench", label: "Left on your bench", higher: false, note: "Points your players score on days every seat is already full" },
    { id: "depth", label: `Depth, ${ordinal(first)}–${ordinal(first + 2)}`, higher: true, note: `What your ${ordinal(first)} to ${ordinal(first + 2)} best players are worth over the window` },
    { id: "missed", label: "Lost to missed games", higher: false, note: "Each player's points per game times the games he's expected to miss (injury and rest)" },
  ];
  return defs.map((d) => ({ ...d, ...spread(you[d.id], all.map((s) => s[d.id]), opts.playoffTeams, d.higher) }));
}

/** Where `v` sits on a track running worst (0) to best (100). */
export function trackPos(v: number, t: Pick<Track, "best" | "worst">): number {
  if (t.best === t.worst) return 50;
  const f = (v - t.worst) / (t.best - t.worst);
  return Math.max(0, Math.min(100, f * 100));
}

// ---------------------------------------------------------------------------
// Your roster by tier
// ---------------------------------------------------------------------------

export interface TierRow {
  tier: number;
  /** Your Nth best player over the window (by value), when you have one. */
  player: PlayerWindowValue | null;
  you: number | null;
  average: number | null;
  /** you − the league's average Nth best. */
  diff: number | null;
  rank: number | null;
  teams: number;
}

export function tierRows(values: LeagueValuesData): TierRow[] {
  const mine = values.players
    .filter((p) => p.mine)
    .sort((a, b) => b.value - a.value || a.window_rank - b.window_rank);
  return [...values.tiers]
    .sort((a: TierBenchmark, b: TierBenchmark) => a.tier - b.tier)
    .map((t) => ({
      tier: t.tier,
      player: mine[t.tier - 1] ?? null,
      you: t.you ?? null,
      average: t.average ?? null,
      diff: t.you != null && t.average != null ? t.you - t.average : null,
      rank: t.rank ?? null,
      teams: t.teams,
    }));
}

export interface TierEdge {
  /** Σ (your Nth best − the league's average Nth best) over the tiers. */
  total: number;
  /** Tiers where you beat the average. */
  ahead: number;
  tiers: number;
  /** The tier you trail the league by most, when you trail at any. */
  worst: TierRow | null;
  /** The tier you lead the league by most, when you lead at any. */
  best: TierRow | null;
}

/** Your first `count` tiers against the league's average. */
export function tierEdge(rows: readonly TierRow[], count: number): TierEdge {
  const top = rows.filter((r) => r.tier <= count && r.diff != null);
  let worst: TierRow | null = null;
  let best: TierRow | null = null;
  for (const r of top) {
    if (r.diff! < 0 && (!worst || r.diff! < worst.diff!)) worst = r;
    if (r.diff! > 0 && (!best || r.diff! > best.diff!)) best = r;
  }
  return {
    total: top.reduce((s, r) => s + r.diff!, 0),
    ahead: top.filter((r) => r.diff! > 0).length,
    tiers: top.length,
    worst,
    best,
  };
}

// ---------------------------------------------------------------------------
// Your week against the league's, matchup by matchup
// ---------------------------------------------------------------------------

export interface WeekBar {
  matchup: number;
  status: "final" | "current" | "upcoming";
  start: string | null;
  end: string | null;
  playoffs: boolean;
  /** The calendar is missing games in it: every roster is undercounted alike. */
  incomplete: boolean;
  /** Your score (final), settled plus projected (current), projected (upcoming). */
  you: number | null;
  median: number | null;
  low: number | null;
  high: number | null;
  line: number | null;
  best: number | null;
  rank: number | null;
  teams: number;
  opponent: string | null;
  opponentScore: number | null;
  winChance: number | null;
  result: "W" | "L" | "T" | null;
}

function resultOf(m: MatchupBenchmark): WeekBar["result"] {
  const r = (m.result ?? "").toUpperCase();
  if (r.startsWith("W")) return "W";
  if (r.startsWith("L")) return "L";
  if (r.startsWith("T")) return "T";
  if (m.status !== "final" || m.you == null || m.opponent_score == null) return null;
  return m.you > m.opponent_score ? "W" : m.you < m.opponent_score ? "L" : "T";
}

export function weekBars(p: LeagueProjectionData): WeekBar[] {
  return [...p.matchups]
    .sort((a, b) => a.matchup - b.matchup)
    .map((m) => ({
      matchup: m.matchup,
      status: m.status === "final" || m.status === "current" ? m.status : "upcoming",
      start: m.start,
      end: m.end,
      playoffs: m.playoffs,
      incomplete: m.schedule_incomplete || p.incomplete_weeks.some((w) => m.weeks.includes(w)),
      you: m.you,
      median: m.median,
      low: m.low,
      high: m.high,
      line: m.line,
      best: m.best,
      rank: m.rank,
      teams: m.teams,
      opponent: m.opponent,
      opponentScore: m.opponent_score,
      winChance: m.win_chance,
      result: resultOf(m),
    }));
}

/** You clear the playoff line that matchup (an undercounted one never says so). */
export function clearsLine(b: WeekBar): boolean {
  return !b.incomplete && b.you != null && b.line != null && b.you >= b.line;
}

/** The chart's range around the median: every bar, band and line, but not the best (it may run off the top). */
export function chartRange(bars: readonly WeekBar[]): { lo: number; hi: number; step: number } {
  let lo = 0;
  let hi = 0;
  for (const b of bars) {
    if (b.median == null) continue;
    for (const v of [b.you, b.low, b.high, b.line]) {
      if (v == null) continue;
      lo = Math.min(lo, v - b.median);
      hi = Math.max(hi, v - b.median);
    }
  }
  const span = Math.max(hi - lo, 40);
  const step = [10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => span / s <= 5) ?? 1000;
  return { lo: Math.floor((lo - span * 0.06) / step) * step, hi: Math.ceil((hi + span * 0.1) / step) * step, step };
}
