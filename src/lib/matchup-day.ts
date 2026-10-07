/**
 * One day of the matchup, spot against spot: your lineup down the left, the
 * opponent's down the right, each player's box score (or the game still to
 * come) beside him, and who leads each stat.
 *
 * Your spots come from the week grid's daily lineups (each day's own ESPN
 * lineup, or the best one, with any staged moves). The opponent's come from
 * today's lineup slot, the only one the API reports: future days carry it
 * forward, as ESPN does unless they edit ahead, and past days reuse it for
 * want of a record. Day totals for finished days are the API's, never a sum
 * over those approximate spots.
 */
import type {
  DayGame,
  DayKind,
  MatchupCategory,
  SeatGroup,
  SourceOpponent,
  StatLine,
  WeekGrid,
  WeekSource,
} from "./week-grid";

export interface DuelSide {
  id: number;
  name: string;
  team: string;
  nbaId: number | null;
  injury: string | null;
  /** That day's game, with its box score once it has one. */
  game: DayGame | null;
  /** Counts toward the team's day: an active spot, a game, not ruled out. */
  counts: boolean;
  /** Points scored (final or live), else the projection for a game to come. */
  fpts: number | null;
  projected: boolean;
  /** Moved there by a staged move (your side). */
  staged: boolean;
  /** The free agent a previewed add brings in (your side). */
  incoming: boolean;
  /** Moved to another spot to make room for that free agent (your side). */
  shifted: boolean;
  /** The player that add drops, in a row of his own (your side). */
  outgoing: boolean;
}

export interface DuelRow {
  key: string;
  slot: string;
  group: SeatGroup;
  you: DuelSide | null;
  opp: DuelSide | null;
  /** Who leads the spot: both counted, higher points. */
  edge: "you" | "opp" | null;
}

export interface SideDay {
  /** Points so far (today), the final (past), null ahead. */
  actual: number | null;
  /** Expected finish (today and ahead), the final for past days. */
  projected: number | null;
  /** Summed box score of the players who count. */
  line: StatLine;
  hasLine: boolean;
  live: number;
  done: number;
  toPlay: number;
}

export interface MatchupDay {
  day: number;
  kind: DayKind;
  rows: DuelRow[];
  you: SideDay;
  opp: SideDay;
  /** The spots are today's, not the day's own (past days, and the opponent's future). */
  spotsAsToday: { you: boolean; opp: boolean };
}

const SLOT_ALIASES: Record<string, string> = { UTIL: "UT", BN: "BE", BENCH: "BE", IL: "IR", "IL+": "IR" };
const canonical = (slot: string | undefined) => {
  const s = (slot ?? "BE").toUpperCase();
  return SLOT_ALIASES[s] ?? s;
};
const groupOf = (slot: string): SeatGroup => (slot === "BE" ? "bench" : slot === "IR" ? "ir" : "active");

export const EMPTY_LINE: StatLine = { min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, fg3m: 0 };

export function addLines(a: StatLine, b: StatLine): StatLine {
  return {
    min: (a.min ?? 0) + (b.min ?? 0),
    pts: a.pts + b.pts,
    reb: a.reb + b.reb,
    ast: a.ast + b.ast,
    stl: a.stl + b.stl,
    blk: a.blk + b.blk,
    tov: a.tov + b.tov,
    fgm: a.fgm + b.fgm,
    fga: a.fga + b.fga,
    ftm: a.ftm + b.ftm,
    fta: a.fta + b.fta,
    fg3m: a.fg3m + b.fg3m,
  };
}

function scored(g: DayGame | null): boolean {
  return !!g && (g.status === "final" || g.status === "live") && g.fpts != null;
}

function oppSide(o: SourceOpponent, day: number, active: boolean): DuelSide {
  const game = o.games[day] ?? null;
  const counts = active && !!game && !game.out;
  return {
    id: o.id,
    name: o.name,
    team: o.team ?? "",
    nbaId: o.nbaId ?? null,
    injury: o.injury ?? null,
    game,
    counts,
    fpts: scored(game) ? game!.fpts : game && !game.out ? o.avg : null,
    projected: !scored(game),
    staged: false,
    incoming: false,
    shifted: false,
    outgoing: false,
  };
}

function sideTotals(sides: Array<DuelSide | null>, actual: number | null, projected: number | null): SideDay {
  let line = EMPTY_LINE;
  let hasLine = false;
  let live = 0;
  let done = 0;
  let toPlay = 0;
  for (const s of sides) {
    if (!s?.counts || !s.game) continue;
    if (s.game.line) {
      line = addLines(line, s.game.line);
      hasLine = true;
    }
    if (s.game.status === "live") live++;
    else if (s.game.status === "final") done++;
    else toPlay++;
  }
  return { actual, projected, line, hasLine, live, done, toPlay };
}

export function buildMatchupDay(source: WeekSource, grid: WeekGrid, day: number): MatchupDay {
  const kind = grid.days[day]?.kind ?? "future";
  const { slots, seats } = grid.lineups;
  const daySeats = seats[day] ?? [];

  // The opponent, seated by today's slot, in the order the API lists them.
  const queue = new Map<string, SourceOpponent[]>();
  for (const o of source.opponents) {
    const slot = canonical(o.slot ?? (o.active ? "UT" : "BE"));
    queue.set(slot, [...(queue.get(slot) ?? []), o]);
  }
  const take = (slot: string) => {
    const list = queue.get(slot);
    return list && list.length ? list.shift()! : null;
  };

  const rows: DuelRow[] = slots.map((def, i) => {
    const seat = daySeats[i] ?? null;
    let you: DuelSide | null = null;
    if (seat) {
      const game = seat.player.games[day] ?? null;
      const counts = !seat.outgoing && seat.cell.counts && !!game && !game.out;
      you = {
        id: seat.player.id,
        name: seat.player.name,
        team: seat.player.team,
        nbaId: seat.player.nbaId,
        injury: seat.player.injury,
        game,
        counts,
        fpts: scored(game) ? game!.fpts : game && !game.out ? seat.player.avg : null,
        projected: !scored(game),
        staged: seat.staged,
        incoming: seat.incoming,
        shifted: !!seat.shifted,
        outgoing: !!seat.outgoing,
      };
    }
    const o = take(canonical(def.slot));
    return { key: def.key, slot: def.slot, group: def.group, you, opp: o ? oppSide(o, day, def.group === "active") : null, edge: null };
  });

  // Opponents in slots your lineup has no row for: their own rows, after yours.
  for (const [slot, list] of queue) {
    for (const o of list) {
      const group = groupOf(slot);
      rows.push({ key: `opp-${o.id}`, slot, group, you: null, opp: oppSide(o, day, group === "active"), edge: null });
    }
  }
  // Keep each group together: active, then bench, then IR, then a previewed add's drop.
  const order: Record<SeatGroup, number> = { active: 0, bench: 1, ir: 2, drop: 3 };
  rows.sort((a, b) => order[a.group] - order[b.group]);

  for (const r of rows) {
    const y = r.you?.counts ? r.you.fpts ?? 0 : null;
    const o = r.opp?.counts ? r.opp.fpts ?? 0 : null;
    if (y == null && o == null) continue;
    if ((y ?? -1) === (o ?? -1)) continue;
    r.edge = (y ?? -1) > (o ?? -1) ? "you" : "opp";
  }

  const youDay = grid.you[day];
  const oppDay = grid.opp[day];
  return {
    day,
    kind,
    rows,
    you: sideTotals(rows.map((r) => r.you), youDay?.actual ?? null, youDay?.projected ?? null),
    opp: sideTotals(rows.map((r) => r.opp), oppDay?.actual ?? null, oppDay?.projected ?? null),
    spotsAsToday: { you: kind === "past", opp: kind !== "today" },
  };
}

// ---------------------------------------------------------------------------
// Who's winning: one bar per stat
// ---------------------------------------------------------------------------

export interface StatBar {
  key: string;
  label: string;
  you: number;
  opp: number;
  lowerIsBetter: boolean;
  isRate: boolean;
  leader: "you" | "opp" | null;
  /** The headline bar (fantasy points). */
  headline?: boolean;
  /** A projection, not a result. */
  projected?: boolean;
}

/** A stat off a summed box score; null for a key the box score can't answer. */
export function statOf(line: StatLine, key: string): number | null {
  switch (key) {
    case "pts":
      return line.pts;
    case "reb":
      return line.reb;
    case "ast":
      return line.ast;
    case "stl":
      return line.stl;
    case "blk":
      return line.blk;
    case "tov":
    case "to":
      return line.tov;
    case "fg3m":
    case "3pm":
      return line.fg3m;
    case "fgm":
      return line.fgm;
    case "ftm":
      return line.ftm;
    case "fg_pct":
      return line.fga > 0 ? line.fgm / line.fga : 0;
    case "ft_pct":
      return line.fta > 0 ? line.ftm / line.fta : 0;
    default:
      return null;
  }
}

const POINTS_STATS: MatchupCategory[] = [
  { key: "pts", label: "PTS", higherIsBetter: true, isRate: false },
  { key: "reb", label: "REB", higherIsBetter: true, isRate: false },
  { key: "ast", label: "AST", higherIsBetter: true, isRate: false },
  { key: "stl", label: "STL", higherIsBetter: true, isRate: false },
  { key: "blk", label: "BLK", higherIsBetter: true, isRate: false },
  { key: "fg3m", label: "3PM", higherIsBetter: true, isRate: false },
  { key: "tov", label: "TO", higherIsBetter: false, isRate: false },
  { key: "fg_pct", label: "FG%", higherIsBetter: true, isRate: true },
  { key: "ft_pct", label: "FT%", higherIsBetter: true, isRate: true },
];

function bar(c: MatchupCategory, you: number, opp: number, extra?: Partial<StatBar>): StatBar {
  const better = c.higherIsBetter ? you - opp : opp - you;
  return {
    key: c.key,
    label: c.label,
    you,
    opp,
    lowerIsBetter: !c.higherIsBetter,
    isRate: c.isRate,
    leader: Math.abs(better) < 1e-9 ? null : better > 0 ? "you" : "opp",
    ...extra,
  };
}

function statBars(stats: MatchupCategory[], you: StatLine, opp: StatLine): StatBar[] {
  return stats.flatMap((c) => {
    const y = statOf(you, c.key);
    const o = statOf(opp, c.key);
    return y == null || o == null ? [] : [bar(c, y, o)];
  });
}

/** The day's bars: fantasy points first (points leagues), then each stat of the players who count. */
export function dayBars(md: MatchupDay, source: WeekSource): StatBar[] {
  const cats = source.format === "categories" && (source.categories?.length ?? 0) > 0;
  const stats = cats ? source.categories! : POINTS_STATS;
  const out: StatBar[] = [];
  if (!cats) {
    const ahead = md.kind === "future";
    const y = (ahead ? md.you.projected : md.you.actual) ?? 0;
    const o = (ahead ? md.opp.projected : md.opp.actual) ?? 0;
    out.push(bar({ key: "fpts", label: "FPTS", higherIsBetter: true, isRate: false }, y, o, { headline: true, projected: ahead }));
  }
  if (md.you.hasLine || md.opp.hasLine) out.push(...statBars(stats, md.you.line, md.opp.line));
  return out;
}

/**
 * The week's bars: the official score (points leagues) or the API's category
 * scores (category leagues), then each stat summed over the days played.
 */
export function weekBars(days: MatchupDay[], source: WeekSource, grid: WeekGrid): StatBar[] {
  const cats = source.format === "categories" && (source.categories?.length ?? 0) > 0;
  let you = EMPTY_LINE;
  let opp = EMPTY_LINE;
  for (const d of days) {
    if (d.kind === "future") continue;
    you = addLines(you, d.you.line);
    opp = addLines(opp, d.opp.line);
  }
  if (cats) {
    const official = new Map((source.weekCategories ?? []).map((c) => [c.key, c]));
    return source.categories!.flatMap((c) => {
      const api = official.get(c.key);
      if (api) return [bar(c, api.you, api.opp)];
      const y = statOf(you, c.key);
      const o = statOf(opp, c.key);
      return y == null || o == null ? [] : [bar(c, y, o)];
    });
  }
  return [
    bar({ key: "fpts", label: "FPTS", higherIsBetter: true, isRate: false }, source.you.current ?? grid.now.you, source.opp.current ?? grid.now.opp, {
      headline: true,
    }),
    ...statBars(POINTS_STATS, you, opp),
  ];
}
