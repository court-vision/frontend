/**
 * Adapters from the API's responses to the week grid's `WeekSource`.
 *
 *   GET /matchups/week/{team}  — every day of the period: box scores for past
 *                                days, the schedule (opponent, tip, injury) for
 *                                future ones, for both teams;
 *   GET /matchups/live/{team}  — today's live points and the official score;
 *   GET /matchups/current/{team} — projected points per game and today's slots;
 *   GET /teams/{team}/lineup   — today's ESPN board (names, eligibility, games).
 *
 * The week's rosters are today's rosters: the API keeps no lineup or roster
 * snapshots, so a player dropped mid-week loses his past rows and an added one
 * shows games from before he arrived.
 */
import type { LineupState } from "@/types/lineup-editor";
import type {
  DailyMatchupFuturePlayer,
  DailyMatchupPlayerStats,
  LiveMatchupData,
  LiveMatchupPlayer,
  MatchupData,
  WeeklyMatchupData,
} from "@/types/matchup";
import type { StreamerPlayer } from "@/types/streamer";
import type { ScheduleGame } from "@/types/games";
import {
  isOutStatus,
  liveClock,
  slotsFromPositions,
  type DayGame,
  type StatLine,
  type SourceOpponent,
  type SourcePlayer,
  type WeekDay,
  type WeekSource,
} from "./week-grid";
import { isActiveSlot } from "./lineup-editor";

const INACTIVE_SLOT_NAMES = new Set(["BE", "BN", "IR", "IL", "IL+"]);

type DayEntry = DailyMatchupPlayerStats | DailyMatchupFuturePlayer;

function isPast(p: DayEntry): p is DailyMatchupPlayerStats {
  return "had_game" in p;
}

/** One side's roster for a day (past days carry box scores, future days the schedule). */
function rosterOf(day: WeeklyMatchupData["days"][number], side: "your_team" | "opponent_team"): DayEntry[] {
  return day[side].roster as DayEntry[];
}

/** A past day's box score, when the player has one. */
function pastLine(p: DailyMatchupPlayerStats): StatLine | null {
  if (p.fpts == null) return null;
  return {
    min: p.min ?? null,
    pts: p.pts ?? 0,
    reb: p.reb ?? 0,
    ast: p.ast ?? 0,
    stl: p.stl ?? 0,
    blk: p.blk ?? 0,
    tov: p.tov ?? 0,
    fgm: p.fgm ?? 0,
    fga: p.fga ?? 0,
    ftm: p.ftm ?? 0,
    fta: p.fta ?? 0,
    fg3m: p.fg3m ?? 0,
  };
}

/** Live overlay for today, when the player's game has a live row. */
function liveGame(p: LiveMatchupPlayer | undefined, opp: string | null, time: string | null, out: boolean): DayGame | null {
  const live = p?.live;
  if (!live) return null;
  const status = live.game_status >= 3 ? "final" : live.game_status === 2 ? "live" : "scheduled";
  const clock = status === "live" ? liveClock(live.period, live.game_clock) : null;
  return {
    opp,
    time,
    status,
    fpts: status === "scheduled" ? null : live.live_fpts,
    clock: clock?.label ?? null,
    remaining: status === "final" ? 0 : status === "live" ? clock!.remaining : 1,
    out: status === "scheduled" && out,
    line:
      status === "scheduled"
        ? null
        : {
            min: live.live_min,
            pts: live.live_pts,
            reb: live.live_reb,
            ast: live.live_ast,
            stl: live.live_stl,
            blk: live.live_blk,
            tov: live.live_tov,
            fgm: live.live_fgm,
            fga: live.live_fga,
            ftm: live.live_ftm,
            fta: live.live_fta,
            fg3m: live.live_fg3m,
          },
  };
}

export interface SourceInputs {
  week: WeeklyMatchupData;
  live: LiveMatchupData | null | undefined;
  matchup: MatchupData | null | undefined;
  board: LineupState | null | undefined;
}

/** The period's days, in order. */
export function weekDaysFromApi(week: WeeklyMatchupData): WeekDay[] {
  return [...week.days]
    .sort((a, b) => a.day_index - b.day_index)
    .map((d, i) => ({
      index: i,
      date: d.date,
      dow: d.day_of_week,
      kind: d.day_type === "past" || d.day_type === "today" ? d.day_type : "future",
    }));
}

export function sourceFromApi({ week, live, matchup, board }: SourceInputs): WeekSource {
  const sortedDays = [...week.days].sort((a, b) => a.day_index - b.day_index);
  const days = weekDaysFromApi(week);
  const todayIndex = days.find((d) => d.kind === "today")?.index ?? null;
  const n = days.length;

  const boardById = new Map((board?.players ?? []).map((p) => [p.player_id, p]));
  const liveMine = new Map((live?.your_team.roster ?? []).map((p) => [p.player_id, p]));
  const liveOpp = new Map((live?.opponent_team.roster ?? []).map((p) => [p.player_id, p]));
  const matchMine = new Map((matchup?.your_team.roster ?? []).map((p) => [p.player_id, p]));
  const matchOpp = new Map((matchup?.opponent_team.roster ?? []).map((p) => [p.player_id, p]));

  // Today's schedule for a player, from the board or (opponents) the week's own today row.
  const todayGame = (
    id: number,
    entry: DailyMatchupPlayerStats | DailyMatchupFuturePlayer | undefined,
    liveRow: LiveMatchupPlayer | undefined,
    injury: string | null
  ): DayGame | null => {
    const b = boardById.get(id);
    // My players' games come off the board; the opponent's off the week's own today row.
    const ahead = entry && !isPast(entry) ? entry : null;
    const opp = b?.opponent ?? ahead?.opponent ?? null;
    const time = b?.game_time_et ?? ahead?.game_time_et ?? null;
    const out = isOutStatus(injury);
    const fromLive = liveGame(liveRow, opp, time, out);
    if (fromLive) return fromLive;
    const hasGame = b ? b.has_game_today : entry ? (isPast(entry) ? entry.had_game : entry.has_game) : false;
    if (!hasGame) return null;
    const fpts = entry && isPast(entry) ? entry.fpts : null;
    if (fpts != null) {
      const line = entry && isPast(entry) ? pastLine(entry) : null;
      return { opp, time, status: "final", fpts, clock: null, remaining: 0, out: false, line };
    }
    return { opp, time, status: "scheduled", fpts: null, clock: null, remaining: 1, out };
  };

  const gamesFor = (
    id: number,
    side: "your_team" | "opponent_team",
    liveRow: LiveMatchupPlayer | undefined,
    injury: string | null
  ): Array<DayGame | null> =>
    sortedDays.map((d, i) => {
      const entry = rosterOf(d, side).find((p) => p.player_id === id);
      const kind = days[i].kind;
      if (kind === "today") return todayGame(id, entry, liveRow, injury);
      if (!entry) return null;
      if (isPast(entry)) {
        if (!entry.had_game) return null;
        return {
          opp: null,
          time: null,
          status: "final",
          fpts: entry.fpts,
          clock: null,
          remaining: 0,
          out: false,
          line: pastLine(entry),
        };
      }
      if (!entry.has_game) return null;
      return {
        opp: entry.opponent,
        time: entry.game_time_et,
        status: "scheduled",
        fpts: null,
        clock: null,
        remaining: 1,
        out: isOutStatus(entry.injury_status),
      };
    });

  // ---- your roster: the board first, then anyone the matchup or week lists ----
  const mineIds: number[] = [];
  const addId = (id: number) => {
    if (!mineIds.includes(id)) mineIds.push(id);
  };
  board?.players.forEach((p) => addId(p.player_id));
  matchup?.your_team.roster.forEach((p) => addId(p.player_id));
  sortedDays.forEach((d) => rosterOf(d, "your_team").forEach((p) => addId(p.player_id)));

  const mine: SourcePlayer[] = mineIds.map((id) => {
    const b = boardById.get(id);
    const m = matchMine.get(id);
    const w = sortedDays.flatMap((d) => rosterOf(d, "your_team")).find((p) => p.player_id === id);
    const liveRow = liveMine.get(id);
    const injury = b?.injury_status ?? m?.injury_status ?? (w && !isPast(w) ? w.injury_status : null) ?? null;
    return {
      id,
      name: b?.name ?? m?.name ?? w?.name ?? `Player ${id}`,
      team: b?.team ?? m?.team ?? w?.team ?? "",
      nbaId: b?.nba_player_id ?? m?.nba_player_id ?? w?.nba_player_id ?? null,
      avg: b?.avg_points ?? m?.avg_points ?? 0,
      injury,
      eligible: b ? b.eligible_slot_ids.filter(isActiveSlot) : slotsFromPositions((m?.position ?? w?.position ?? "").split(/[,/]/)),
      games: gamesFor(id, "your_team", liveRow, injury),
    };
  });

  // ---- the opponent ----
  const oppIds: number[] = [];
  matchup?.opponent_team.roster.forEach((p) => oppIds.includes(p.player_id) || oppIds.push(p.player_id));
  sortedDays.forEach((d) =>
    rosterOf(d, "opponent_team").forEach((p) => oppIds.includes(p.player_id) || oppIds.push(p.player_id))
  );
  const opponents: SourceOpponent[] = oppIds.map((id) => {
    const m = matchOpp.get(id);
    const liveRow = liveOpp.get(id);
    const w = sortedDays.flatMap((d) => rosterOf(d, "opponent_team")).find((p) => p.player_id === id);
    const slot = liveRow?.lineup_slot ?? m?.lineup_slot ?? "BE";
    const injury = liveRow?.injury_status ?? m?.injury_status ?? (w && !isPast(w) ? w.injury_status : null) ?? null;
    return {
      id,
      name: m?.name ?? liveRow?.name ?? w?.name ?? `Player ${id}`,
      avg: m?.avg_points ?? liveRow?.avg_points ?? 0,
      active: !INACTIVE_SLOT_NAMES.has(slot.toUpperCase()),
      games: gamesFor(id, "opponent_team", liveRow, injury),
      team: m?.team ?? liveRow?.team ?? w?.team ?? "",
      nbaId: m?.nba_player_id ?? liveRow?.nba_player_id ?? w?.nba_player_id ?? null,
      slot,
      injury,
    };
  });

  // The week by category: live-adjusted when the live matchup has it.
  const comparison = live?.category_comparison ?? matchup?.category_comparison ?? null;

  const activeSlotCount = board
    ? board.slots.filter((s) => isActiveSlot(s.slot_id)).reduce((s, d) => s + d.count, 0)
    : 10;

  return {
    period: week.matchup_period,
    days,
    todayIndex,
    you: {
      name: live?.your_team.team_name ?? matchup?.your_team.team_name ?? sortedDays[0]?.your_team.team_name ?? "You",
      current: live?.your_team.current_score ?? matchup?.your_team.current_score ?? null,
    },
    opp: {
      name:
        live?.opponent_team.team_name ?? matchup?.opponent_team.team_name ?? sortedDays[0]?.opponent_team.team_name ?? "Opponent",
      current: live?.opponent_team.current_score ?? matchup?.opponent_team.current_score ?? null,
    },
    mine,
    opponents,
    pastTotals: {
      you: sortedDays.map((d, i) => (days[i].kind === "past" ? d.your_team.total_fpts ?? null : null)),
      opp: sortedDays.map((d, i) => (days[i].kind === "past" ? d.opponent_team.total_fpts ?? null : null)),
    },
    activeSlotCount: n > 0 ? activeSlotCount : 10,
    format: (live?.scoring_format ?? matchup?.scoring_format) === "categories" ? "categories" : "points",
    categories: (comparison?.items ?? []).map((c) => ({
      key: c.key,
      label: c.label,
      higherIsBetter: c.higher_is_better,
      isRate: c.is_rate,
    })),
    weekCategories: comparison ? comparison.items.map((c) => ({ key: c.key, you: c.you, opp: c.opp })) : null,
  };
}

/**
 * A free agent as a grid player. `game_days` are the remaining day indices of
 * the period; opponents and tip times come from his team's schedule when it
 * has loaded (keyed by date). `firstDay` is the first day an add made now
 * counts: ESPN puts a pickup made after the day's first tip on the next day.
 */
export function sourceFromStreamer(
  fa: StreamerPlayer,
  days: WeekDay[],
  schedule?: ScheduleGame[] | null,
  firstDay: number | null = null
): SourcePlayer {
  const byDate = new Map((schedule ?? []).map((g) => [g.date.slice(0, 10), g]));
  const playing = new Set(fa.game_days);
  return {
    id: fa.player_id,
    name: fa.name,
    team: fa.team,
    nbaId: fa.nba_player_id ?? null,
    avg: fa.avg_points_last_n ?? fa.avg_points_season,
    injury: fa.injury_status ?? null,
    eligible: slotsFromPositions(fa.valid_positions),
    games: days.map((d) => {
      if (!playing.has(d.index) || d.kind === "past") return null;
      if (firstDay != null && d.index < firstDay) return null;
      const g = byDate.get(d.date);
      // Today's game only counts if it hasn't tipped (the schedule says "scheduled").
      if (d.kind === "today" && g && g.status !== "scheduled") return null;
      return {
        opp: g ? `${g.home ? "vs" : "@"} ${g.opponent}` : null,
        time: null,
        status: "scheduled",
        fpts: null,
        clock: null,
        remaining: 1,
        out: isOutStatus(fa.injury_status),
      };
    }),
  };
}
