/**
 * Stream lanes as the week desk lays them out: who holds the lane's spot each
 * day of the week (what it did, what it projects), the projection as a chain of
 * previewed free agents for the grid, its history in words, and a demo planner.
 *
 * The server decides each day afresh, before that day's games, and stores its
 * latest projection (from the day it last decided on). Days before that are
 * told by the lane's events: a switch (with its pickup's outcome), a keep, a day
 * it couldn't act on.
 */
import type { LanePlayer, LaneProjection, StreamLane, StreamLaneEvent, StreamLanePlan } from "@/types/stream-lane";
import type { StreamerPlayer } from "@/types/streamer";
import type { DayGame, Incoming, SourcePlayer, WeekDay, WeekSource } from "./week-grid";

/** One day of the lane in the week. */
export interface LaneCell {
  /** Who holds the spot that day. */
  player: LanePlayer;
  /**
   * made: a switch that went through; scheduled: a switch whose pickup is pending;
   * failed: a switch that didn't go through (the spot's player stayed); kept: the
   * lane decided to keep him; missed: no decision was made in time; projected: the
   * plan ahead, which can change.
   */
  state: "made" | "scheduled" | "failed" | "kept" | "missed" | "projected";
  /** A new player takes the spot this day. */
  switch: boolean;
  /** What he adds to the day's lineup, as projected. */
  value: number | null;
  /** For a failed switch: who it would have brought in, and why it didn't. */
  note: string | null;
}

const byId = (a: StreamLaneEvent, b: StreamLaneEvent) => a.id - b.id;

/**
 * The lane's cell for each day of the week (null outside its days). Decided days
 * come from its events; the rest from its projection.
 */
export function laneCells(lane: StreamLane, days: ReadonlyArray<WeekDay>): Array<LaneCell | null> {
  const events = [...lane.events].sort(byId);
  // Who held the spot going into each decided day: the original player, then each switch that went through.
  let holder: LanePlayer = lane.original;
  const decided = new Map<string, LaneCell>();
  for (const e of events) {
    if (!e.nba_date) continue;
    if (e.action === "switch" && e.add) {
      const status = e.pickup_status ?? "pending";
      if (status === "executed") {
        decided.set(e.nba_date, { player: e.add, state: "made", switch: true, value: null, note: null });
        holder = e.add;
      } else if (status === "pending") {
        decided.set(e.nba_date, { player: e.add, state: "scheduled", switch: true, value: null, note: null });
      } else {
        decided.set(e.nba_date, { player: holder, state: "failed", switch: false, value: null, note: `${e.add.name}: ${status}` });
      }
    } else if (e.action === "keep") {
      decided.set(e.nba_date, { player: holder, state: "kept", switch: false, value: null, note: null });
    } else if (e.action === "blocked" && e.reason === "missed") {
      decided.set(e.nba_date, { player: holder, state: "missed", switch: false, value: null, note: e.detail ?? null });
    } else if (e.action === "blocked" && e.pickup_id != null) {
      // A switch whose pickup settled without going through: the spot's player stayed.
      decided.set(e.nba_date, {
        player: holder,
        state: "failed",
        switch: false,
        value: null,
        note: e.add ? `${e.add.name}: ${e.reason ?? "not made"}` : e.reason ?? null,
      });
    }
  }
  const projected = new Map((lane.projection?.days ?? []).map((d) => [d.nba_date, d]));
  return days.map((d) => {
    const made = decided.get(d.date);
    const ahead = projected.get(d.date);
    if (made) return { ...made, value: ahead && ahead.player.player_id === made.player.player_id ? ahead.value : made.value };
    if (ahead) return { player: ahead.player, state: "projected", switch: ahead.switch, value: ahead.value, note: null };
    return null;
  });
}

/**
 * The projection as previewed free agents for the grid: each run of days a free
 * agent holds the spot, replacing the lane's holder (who must be on the roster).
 * Days already played, and days the holder keeps, add nothing.
 */
export function laneStretches(
  projection: LaneProjection | null | undefined,
  holderId: number,
  days: ReadonlyArray<WeekDay>,
  sourceOf: (player: LanePlayer, from: number) => SourcePlayer
): Incoming[] {
  if (!projection) return [];
  const holderOn = new Map<number, LanePlayer>();
  for (const pd of projection.days) {
    const day = days.find((d) => d.date === pd.nba_date);
    if (day && day.kind !== "past") holderOn.set(day.index, pd.player);
  }
  const out: Incoming[] = [];
  let run: { player: LanePlayer; from: number } | null = null;
  const close = (until: number) => {
    if (run) out.push({ player: sourceOf(run.player, run.from), replaces: holderId, from: run.from, until });
    run = null;
  };
  for (const d of days) {
    const p = holderOn.get(d.index);
    if (!p || p.player_id === holderId) {
      close(d.index);
      continue;
    }
    if (run && run.player.player_id === p.player_id) continue;
    close(d.index);
    run = { player: p, from: d.index };
  }
  if (run) {
    const last = run as { player: LanePlayer; from: number };
    out.push({ player: sourceOf(last.player, last.from), replaces: holderId, from: last.from });
  }
  return out;
}

/**
 * A grid player for a projected free agent the desk's pool doesn't list: a game
 * on each day the projection has him adding something, at that value. Seated as
 * UT-only, which the preview treats as "fits somewhere".
 */
export function projectedSource(player: LanePlayer, projection: LaneProjection, days: ReadonlyArray<WeekDay>): SourcePlayer {
  const values = new Map(
    projection.days.filter((d) => d.player.player_id === player.player_id).map((d) => [d.nba_date, d.value])
  );
  const avg = Math.max(0, ...values.values());
  return {
    id: player.player_id,
    name: player.name,
    team: player.team ?? "",
    nbaId: player.nba_player_id ?? null,
    avg,
    injury: null,
    eligible: [11],
    games: days.map((d): DayGame | null =>
      (values.get(d.date) ?? 0) > 0
        ? { opp: null, time: null, status: "scheduled", fpts: null, clock: null, remaining: 1, out: false }
        : null
    ),
  };
}

// ---------------------------------------------------------------------------
// In words
// ---------------------------------------------------------------------------

const WHY: Record<string, string> = {
  as_projected: "as projected",
  projected_gone: "the projected player was gone",
  replanned: "re-planned with the latest projections",
};

const LANE_REASONS: Record<string, string> = {
  holder_gone: "the spot's player left the roster",
  auth_expired: "your ESPN connection expired",
  provider_not_supported: "this league's rosters can't be changed from here",
  waiver_period_unsupported: "this league's waiver period is too long for lanes",
  paused_by_user: "you paused it",
  stopped: "you stopped it",
  matchup_over: "the matchup ended",
  team_not_found: "the team is gone",
  missed: "no decision was made in time",
  already_scheduled: "that player was already scheduled",
  unavailable: "he was no longer available",
  acquisition_limit: "the league's add limit was reached",
  roster_full: "the roster was full",
  deadline: "the day's games started first",
  espn_rejected: "ESPN refused it",
};

/** Why a lane is paused or ended, in words. */
export function laneReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (reason.startsWith("can_write:")) return "ESPN won't take changes for this team right now";
  return LANE_REASONS[reason] ?? reason.replace(/_/g, " ");
}

/** One line of a lane's history. */
export function eventLine(e: StreamLaneEvent, dayLabel: (date: string) => string): string {
  const day = e.nba_date ? `${dayLabel(e.nba_date)}: ` : "";
  const why = e.reason && WHY[e.reason] ? ` (${WHY[e.reason]})` : "";
  switch (e.action) {
    case "started":
      return `Started${e.nba_date ? `, from ${dayLabel(e.nba_date)}` : ""}`;
    case "switch": {
      const outcome =
        e.pickup_status === "executed" ? "picked up" : e.pickup_status === "pending" || !e.pickup_status ? "picking up" : "tried to pick up";
      return `${day}${outcome} ${e.add?.name ?? "a free agent"}${e.drop ? ` for ${e.drop.name}` : ""}${why}`;
    }
    case "keep":
      return `${day}kept the spot as it was${why}`;
    case "blocked":
      return `${day}couldn't act: ${laneReason(e.reason) ?? "unknown"}`;
    case "paused":
      return `Paused: ${laneReason(e.reason) ?? "unknown"}`;
    case "resumed":
      return "Resumed";
    case "ended":
      return `Ended: ${laneReason(e.reason) ?? "unknown"}`;
  }
}

// ---------------------------------------------------------------------------
// Demo: a projection made in the browser
// ---------------------------------------------------------------------------

/**
 * A demo lane's projection: each open day, the free agent worth most that day
 * takes the spot when he beats whoever holds it, while adds last (a player
 * dropped yesterday can't come straight back). Cruder than the server's plan,
 * which weighs every day of the week at once; the demo says so.
 */
export function demoLanePlan(
  source: WeekSource,
  holderId: number,
  pool: ReadonlyArray<StreamerPlayer>,
  firstDay: number,
  adds: number | null,
  periodOf: (day: number) => number,
  now: Date
): StreamLanePlan | null {
  const holder = source.mine.find((p) => p.id === holderId);
  if (!holder) return null;
  const days = source.days.filter((d) => d.index >= firstDay);
  if (days.length === 0) return null;
  const lane = (p: { id: number; name: string; team: string; nbaId: number | null }): LanePlayer => ({
    player_id: p.id,
    name: p.name,
    team: p.team,
    nba_player_id: p.nbaId,
  });
  const valueOf = (fa: StreamerPlayer) => fa.avg_points_last_n ?? fa.avg_points_season;
  let current: { player: LanePlayer; value: (day: number) => number } = {
    player: lane(holder),
    value: (day) => (holder.games[day] && !holder.games[day]!.out ? holder.avg : 0),
  };
  let left = adds ?? Infinity;
  let dropped: number | null = null;
  const out: LaneProjection["days"] = [];
  let value = 0;
  let holdValue = 0;
  let used = 0;
  for (const d of days) {
    holdValue += holder.games[d.index] && !holder.games[d.index]!.out ? holder.avg : 0;
    const best = pool
      .filter((fa) => fa.game_days.includes(d.index) && fa.player_id !== current.player.player_id && fa.player_id !== dropped)
      .sort((a, b) => valueOf(b) - valueOf(a))[0];
    const keep = current.value(d.index);
    let switched = false;
    dropped = null;
    if (best && left > 0 && valueOf(best) > keep + 0.5) {
      dropped = current.player.player_id;
      current = {
        player: { player_id: best.player_id, name: best.name, team: best.team, nba_player_id: best.nba_player_id ?? null },
        value: (day) => (best.game_days.includes(day) ? valueOf(best) : 0),
      };
      left -= 1;
      used += 1;
      switched = true;
    }
    const v = current.value(d.index);
    value += v;
    out.push({ scoring_period_id: periodOf(d.index), nba_date: d.date, player: current.player, value: Math.round(v * 100) / 100, switch: switched });
  }
  const last = days[days.length - 1];
  return {
    holder: lane(holder),
    start_period: periodOf(days[0].index),
    end_period: periodOf(last.index),
    end_date: last.date,
    first_decision_at: now.toISOString(),
    projection: {
      as_of: now.toISOString(),
      days: out,
      value: Math.round(value * 100) / 100,
      hold_value: Math.round(holdValue * 100) / 100,
      gain: Math.round((value - holdValue) * 100) / 100,
      adds: used,
      adds_left: adds,
      rehold_after: 2,
    },
  };
}
