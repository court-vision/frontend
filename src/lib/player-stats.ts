/**
 * The Week desk's player stats pane: the pure parts. Who a stats id names
 * (yours, the opponent's, a free agent) is the desk's to resolve; this turns
 * what it finds into the pane's player and sums his week.
 */
import type { SourceOpponent, SourcePlayer, WeekDay } from "./week-grid";

/** Whose player the pane shows: yours, a free agent in the market, or the opponent's. */
export type StatsKind = "mine" | "fa" | "opp";

/** An opponent's player as the pane reads him (no lineup slots of yours to fill). */
export function opponentAsPlayer(opp: SourceOpponent): SourcePlayer {
  return {
    id: opp.id,
    name: opp.name,
    team: opp.team ?? "",
    nbaId: opp.nbaId ?? null,
    avg: opp.avg,
    injury: opp.injury ?? null,
    eligible: [],
    games: opp.games,
  };
}

export interface WeekSummary {
  /** Games played or under way. */
  played: number;
  /** Their points (live ones so far). */
  scored: number;
  /** Games still to tip, not ruled out. */
  left: number;
  /** `left` at his projected points per game. */
  projected: number;
}

/** What his week has given and has left. A game ruled out counts neither way. */
export function weekSummary(player: SourcePlayer, days: readonly WeekDay[], todayIndex: number | null): WeekSummary {
  let played = 0;
  let scored = 0;
  let left = 0;
  days.forEach((_, i) => {
    const g = player.games[i];
    if (!g || g.out) return;
    if (g.status === "final" || g.status === "live") {
      played++;
      scored += g.fpts ?? 0;
    } else if (todayIndex == null || i >= todayIndex) {
      left++;
    }
  });
  return { played, scored, left, projected: left * player.avg };
}
