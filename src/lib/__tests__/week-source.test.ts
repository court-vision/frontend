import { describe, expect, test } from "bun:test";
import { sourceFromApi, sourceFromStreamer } from "../week-source";
import type { LiveMatchupData, MatchupData, WeeklyMatchupData } from "../../types/matchup";
import type { StreamerPlayer } from "../../types/streamer";

const team = (roster: unknown[], total: number | null) => ({ team_id: 1, team_name: "T", total_fpts: total, roster, categories: null });

const past = (id: number, fpts: number | null, hadGame = true) => ({
  player_id: id, name: `P${id}`, team: "DEN", position: "C", nba_player_id: null, had_game: hadGame, fpts,
});
const future = (id: number, hasGame: boolean, injury: string | null = null) => ({
  player_id: id, name: `P${id}`, team: "DEN", position: "C", nba_player_id: null,
  has_game: hasGame, opponent: hasGame ? "@ LAL" : null, game_time_et: hasGame ? "22:00" : null,
  injured: injury === "OUT", injury_status: injury,
});

const week = {
  matchup_period: 3,
  days: [
    { date: "2026-11-10", day_type: "today", day_of_week: "Tue", day_index: 1, your_team: team([past(1, null), past(2, null, false)], 0), opponent_team: team([past(9, 12, true)], 12) },
    { date: "2026-11-09", day_type: "past", day_of_week: "Mon", day_index: 0, your_team: team([past(1, 40.5), past(2, null, false)], 40.5), opponent_team: team([past(9, 30, true)], 30) },
    { date: "2026-11-11", day_type: "future", day_of_week: "Wed", day_index: 2, your_team: team([future(1, true), future(2, true, "OUT")], null), opponent_team: team([future(9, true)], null) },
  ],
} as unknown as WeeklyMatchupData;

const live = {
  your_team: {
    team_name: "Mine", current_score: 61, projected_score: 0, team_id: 1,
    roster: [{ player_id: 1, name: "P1", team: "DEN", lineup_slot: "C", avg_points: 50, live: { game_status: 2, period: 3, game_clock: "PT04M12.00S", live_fpts: 20.5 } }],
  },
  opponent_team: {
    team_name: "Theirs", current_score: 42, projected_score: 0, team_id: 2,
    roster: [{ player_id: 9, name: "P9", team: "MIA", lineup_slot: "BE", avg_points: 30, live: null }],
  },
} as unknown as LiveMatchupData;

const matchup = {
  your_team: { team_name: "Mine", current_score: 40.5, roster: [{ player_id: 2, name: "P2", team: "DEN", avg_points: 22, position: "PF", lineup_slot: "BE" }] },
  opponent_team: { team_name: "Theirs", current_score: 30, roster: [{ player_id: 9, name: "P9", team: "MIA", avg_points: 31, position: "SG", lineup_slot: "BE" }] },
} as unknown as MatchupData;

describe("sourceFromApi", () => {
  const src = sourceFromApi({ week, live, matchup, board: null });

  test("orders days and finds today", () => {
    expect(src.days.map((d) => d.dow)).toEqual(["Mon", "Tue", "Wed"]);
    expect(src.todayIndex).toBe(1);
    expect(src.period).toBe(3);
  });

  test("past days carry box scores; today takes the live overlay", () => {
    const p1 = src.mine.find((p) => p.id === 1)!;
    expect(p1.games[0]).toMatchObject({ status: "final", fpts: 40.5 });
    expect(p1.games[1]).toMatchObject({ status: "live", fpts: 20.5, clock: "Q3 4:12" });
    expect(p1.games[2]).toMatchObject({ status: "scheduled", opp: "@ LAL", time: "22:00", out: false });
  });

  test("a future game with an OUT status is out; no game is null", () => {
    const p2 = src.mine.find((p) => p.id === 2)!;
    expect(p2.games[0]).toBeNull();
    expect(p2.games[2]?.out).toBe(true);
    expect(p2.avg).toBe(22);
  });

  test("the official score and the API's past totals", () => {
    expect(src.you.current).toBe(61);
    expect(src.opp.current).toBe(42);
    expect(src.pastTotals.you).toEqual([40.5, null, null]);
    expect(src.opponents[0]).toMatchObject({ id: 9, avg: 31, active: false });
  });
});

describe("sourceFromStreamer", () => {
  test("game days become scheduled games; a tipped game today is dropped", () => {
    const fa = {
      player_id: 7, name: "FA", team: "POR", nba_player_id: null, valid_positions: ["SF", "PF"],
      avg_points_last_n: null, avg_points_season: 25, game_days: [1, 2], injury_status: null,
    } as unknown as StreamerPlayer;
    const days = sourceFromApi({ week, live, matchup, board: null }).days;
    const p = sourceFromStreamer(fa, days, [
      { date: "2026-11-10", opponent: "PHI", home: true, status: "in_progress" },
      { date: "2026-11-11", opponent: "PHX", home: false, status: "scheduled" },
    ] as never);
    expect(p.avg).toBe(25);
    expect(p.games[1]).toBeNull();
    expect(p.games[2]).toMatchObject({ opp: "@ PHX", status: "scheduled" });
    expect(p.eligible).toEqual([2, 3, 6, 11]);
  });
});
