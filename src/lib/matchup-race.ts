/**
 * The week's race: both teams' running totals at the end of every day of the
 * matchup, and the lead between them. Finished days come from ESPN's nightly
 * snapshots where one exists (the snapshot dated day k holds the totals
 * through day k − 1) and from the week's own day totals where it doesn't;
 * today is the live score; the days ahead are the projection. Category
 * leagues race on categories won instead, with no projection. Pure.
 */
import type { DailyScorePoint } from "@/types/matchup";
import type { DayTotal, MatchupCategory, WeekDay } from "./week-grid";

export type RaceKind = "start" | "final" | "now" | "projected";

export interface RacePoint {
  /** On the week's axis: 0 = before the first day, i + 1 = the end of day i; now sits halfway through today. */
  x: number;
  you: number;
  opp: number;
  margin: number;
  kind: RaceKind;
  /** Where a finished day's totals came from: ESPN's nightly snapshot, or the week's own day totals. */
  from: "espn" | "week" | null;
}

export interface RaceDay {
  index: number;
  dow: string;
  date: string;
  kind: WeekDay["kind"];
  /** The day's own points: the final, or (today and ahead) what it is expected to finish at. */
  you: number;
  opp: number;
  /** The running margin at the day's end. */
  margin: number;
  projected: boolean;
}

export interface LeadChange {
  /** Where on the week's axis the margin crossed zero. */
  x: number;
  /** The day it happened in. */
  day: number;
  to: "you" | "opp";
  projected: boolean;
}

export interface Race {
  points: RacePoint[];
  days: RaceDay[];
  changes: LeadChange[];
  /** The widest lead each side has held (the projection doesn't count). */
  best: { you: RacePoint | null; opp: RacePoint | null };
  /** Where the race ends: the projected finish (points), or where it stands now (categories). */
  end: RacePoint;
  /** Finished days whose totals are ESPN's own snapshots. */
  fromEspn: number;
}

export interface RaceInput {
  days: WeekDay[];
  you: DayTotal[];
  opp: DayTotal[];
  /** The live score: ESPN's running total with tonight's games on top. */
  now: { you: number; opp: number };
  history: readonly DailyScorePoint[] | null | undefined;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function point(x: number, you: number, opp: number, kind: RaceKind, from: RacePoint["from"] = null): RacePoint {
  return { x, you: r1(you), opp: r1(opp), margin: r1(you - opp), kind, from };
}

/** The points race, day by day. */
export function buildRace({ days, you: youDays, opp: oppDays, now, history }: RaceInput): Race {
  const snaps = new Map((history ?? []).map((h) => [h.day_of_matchup, h]));
  const points: RacePoint[] = [point(0, 0, 0, "start")];
  const out: RaceDay[] = [];
  let you = 0;
  let opp = 0;
  for (const d of days) {
    const i = d.index;
    const startYou = you;
    const startOpp = opp;
    if (d.kind === "past") {
      const snap = snaps.get(i + 1);
      if (snap) {
        you = snap.your_score;
        opp = snap.opponent_score;
      } else {
        you += youDays[i]?.actual ?? youDays[i]?.projected ?? 0;
        opp += oppDays[i]?.actual ?? oppDays[i]?.projected ?? 0;
      }
      points.push(point(i + 1, you, opp, "final", snap ? "espn" : "week"));
    } else if (d.kind === "today") {
      points.push(point(i + 0.5, now.you, now.opp, "now"));
      you = now.you + (youDays[i]?.projected ?? 0) - (youDays[i]?.actual ?? 0);
      opp = now.opp + (oppDays[i]?.projected ?? 0) - (oppDays[i]?.actual ?? 0);
      points.push(point(i + 1, you, opp, "projected"));
    } else {
      you += youDays[i]?.projected ?? 0;
      opp += oppDays[i]?.projected ?? 0;
      points.push(point(i + 1, you, opp, "projected"));
    }
    out.push({
      index: i,
      dow: d.dow,
      date: d.date,
      kind: d.kind,
      you: r1(you - startYou),
      opp: r1(opp - startOpp),
      margin: r1(you - opp),
      projected: d.kind !== "past",
    });
  }
  return finish(points, out);
}

function finish(points: RacePoint[], days: RaceDay[]): Race {
  const actual = points.filter((p) => p.kind === "final" || p.kind === "now");
  const top = actual.reduce<RacePoint | null>((b, p) => (p.margin > 0 && (!b || p.margin > b.margin) ? p : b), null);
  const bottom = actual.reduce<RacePoint | null>((b, p) => (p.margin < 0 && (!b || p.margin < b.margin) ? p : b), null);
  return {
    points,
    days,
    changes: leadChanges(points),
    best: { you: top, opp: bottom },
    end: points[points.length - 1],
    fromEspn: points.filter((p) => p.from === "espn").length,
  };
}

/** Where the lead changed hands: the margin crossing zero from one side to the other (a tie isn't a lead). */
export function leadChanges(points: readonly RacePoint[]): LeadChange[] {
  const out: LeadChange[] = [];
  let leader = 0;
  for (let k = 1; k < points.length; k++) {
    const p = points[k];
    const sign = Math.sign(p.margin);
    if (sign === 0) continue;
    if (leader !== 0 && sign !== leader) {
      // The point before is the old leader's or a tie: the line meets zero between them.
      const prev = points[k - 1];
      const x = prev.margin === 0 ? prev.x : prev.x + ((p.x - prev.x) * prev.margin) / (prev.margin - p.margin);
      out.push({ x: Math.round(x * 100) / 100, day: Math.max(0, Math.ceil(x) - 1), to: sign > 0 ? "you" : "opp", projected: p.kind === "projected" });
    }
    leader = sign;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Category leagues: the race in categories won
// ---------------------------------------------------------------------------

export type Leader = "you" | "opp" | "tie" | null;

export interface CategoryColumn {
  /** The day whose end it describes (or today, so far). */
  day: number;
  x: number;
  kind: "final" | "now";
  cells: Record<string, { you: number | null; opp: number | null; leader: Leader }>;
  won: number;
  lost: number;
  tied: number;
}

export function categoryLeader(c: Pick<MatchupCategory, "higherIsBetter">, you: number | null | undefined, opp: number | null | undefined): Leader {
  if (you == null || opp == null) return null;
  if (you === opp) return "tie";
  return (you > opp) === c.higherIsBetter ? "you" : "opp";
}

function column(
  categories: readonly MatchupCategory[],
  day: number,
  x: number,
  kind: CategoryColumn["kind"],
  you: Record<string, number> | null | undefined,
  opp: Record<string, number> | null | undefined
): CategoryColumn {
  const cells: CategoryColumn["cells"] = {};
  let won = 0;
  let lost = 0;
  let tied = 0;
  for (const c of categories) {
    const y = you?.[c.key] ?? null;
    const o = opp?.[c.key] ?? null;
    const leader = categoryLeader(c, y, o);
    if (leader === "you") won++;
    else if (leader === "opp") lost++;
    else if (leader === "tie") tied++;
    cells[c.key] = { you: y, opp: o, leader };
  }
  return { day, x, kind, cells, won, lost, tied };
}

/**
 * The category race: each finished day's standing from ESPN's snapshots (a day
 * without one is left out; the week has no per-category day totals to fall
 * back on), and today's from the live week so far.
 */
export function categoryRace(
  categories: readonly MatchupCategory[],
  days: readonly WeekDay[],
  history: readonly DailyScorePoint[] | null | undefined,
  live: ReadonlyArray<{ key: string; you: number; opp: number }> | null | undefined
): CategoryColumn[] {
  const snaps = new Map((history ?? []).map((h) => [h.day_of_matchup, h]));
  const out: CategoryColumn[] = [];
  for (const d of days) {
    if (d.kind === "past") {
      const snap = snaps.get(d.index + 1);
      if (snap?.your_categories && snap.opponent_categories) {
        out.push(column(categories, d.index, d.index + 1, "final", snap.your_categories, snap.opponent_categories));
      }
    } else if (d.kind === "today" && live?.length) {
      const you = Object.fromEntries(live.map((c) => [c.key, c.you]));
      const opp = Object.fromEntries(live.map((c) => [c.key, c.opp]));
      out.push(column(categories, d.index, d.index + 0.5, "now", you, opp));
    }
  }
  return out;
}

/** The category race as a race: categories won against lost at each column, no projection. */
export function categoryRacePoints(columns: readonly CategoryColumn[]): Race {
  const points: RacePoint[] = [point(0, 0, 0, "start")];
  for (const c of columns) points.push({ x: c.x, you: c.won, opp: c.lost, margin: c.won - c.lost, kind: c.kind, from: c.kind === "final" ? "espn" : null });
  return finish(points, []);
}

/** "+12.5", "−3.0" (a real minus), "even". */
export function marginText(margin: number, digits: number = 1): string {
  if (Math.abs(margin) < 0.05) return "even";
  return `${margin > 0 ? "+" : "−"}${Math.abs(margin).toFixed(digits)}`;
}
