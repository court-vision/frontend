import { describe, expect, test } from "bun:test";
import { gridCellTitle, rulingTitle, verdictAsk, withVerdicts } from "../availability";
import { sourceFromApi } from "../week-source";
import type { GridCell, Ruling } from "../week-grid";
import type { LiveMatchupData, WeeklyMatchupData } from "../../types/matchup";
import type { Verdict } from "../../types/availability";

const team = (roster: unknown[]) => ({ team_id: 1, team_name: "T", total_fpts: null, roster, categories: null });
const past = (id: number, nba: number | null) => ({
  player_id: id, name: `P${id}`, team: "NYK", position: "PG", nba_player_id: nba, had_game: true, fpts: 30,
});
const ahead = (id: number, nba: number | null, injury: string | null = null) => ({
  player_id: id, name: `P${id}`, team: "NYK", position: "PG", nba_player_id: nba,
  has_game: true, opponent: "vs BOS", game_time_et: "19:30", injured: injury === "OUT", injury_status: injury,
});

// Mon is played; Tue is today; Wed is to come. 1 and 2 are mine (2 is OUT on ESPN), 9 is theirs, 5 has no NBA id.
const week = {
  matchup_period: 4,
  days: [
    { date: "2026-11-09", day_type: "past", day_of_week: "Mon", day_index: 0, your_team: team([past(1, 101), past(2, 102)]), opponent_team: team([past(9, 109)]) },
    { date: "2026-11-10", day_type: "today", day_of_week: "Tue", day_index: 1, your_team: team([ahead(1, 101), ahead(2, 102, "OUT"), ahead(5, null)]), opponent_team: team([ahead(9, 109)]) },
    { date: "2026-11-11", day_type: "future", day_of_week: "Wed", day_index: 2, your_team: team([ahead(1, 101), ahead(2, 102, "OUT")]), opponent_team: team([ahead(9, 109, "SUSPENSION")]) },
  ],
} as unknown as WeeklyMatchupData;

const verdict = (nba: number, date: string, word: Verdict["verdict"], extra: Partial<Verdict> = {}): Verdict => ({
  nba_player_id: nba, game_date: date, verdict: word, final: false, decided_by: "espn_injuries",
  reason: "Left Ankle; Sprain", detail: null, expected_return: null, previous_verdict: null,
  changed_at: "2026-11-10T21:30:00Z", ...extra,
});

describe("verdictAsk", () => {
  test("both rosters' NBA ids over today and the days left", () => {
    const live = {
      your_team: { roster: [{ player_id: 3, nba_player_id: 103 }] },
      opponent_team: { roster: [{ player_id: 8, nba_player_id: 108 }] },
    } as unknown as LiveMatchupData;
    const ask = verdictAsk({ week, live, matchup: null, board: null });
    expect(ask).toEqual({ nbaIds: [101, 102, 103, 108, 109], start: "2026-11-10", end: "2026-11-11" });
  });

  test("nothing to ask once every day is played, or of a week with no NBA ids", () => {
    const played = { ...week, days: week.days.map((d) => ({ ...d, day_type: "past" })) } as unknown as WeeklyMatchupData;
    expect(verdictAsk({ week: played, live: null, matchup: null, board: null })).toBeNull();
    const nameless = {
      ...week,
      days: week.days.map((d) => ({ ...d, your_team: team([ahead(5, null)]), opponent_team: team([]) })),
    } as unknown as WeeklyMatchupData;
    expect(verdictAsk({ week: nameless, live: null, matchup: null, board: null })).toBeNull();
  });

  test("a long period asks for two weeks at most", () => {
    const days = Array.from({ length: 20 }, (_, i) => ({
      date: `2026-11-${String(i + 1).padStart(2, "0")}`, day_type: i === 0 ? "today" : "future", day_of_week: "x",
      day_index: i, your_team: team([ahead(1, 101)]), opponent_team: team([]),
    }));
    const ask = verdictAsk({ week: { ...week, days } as unknown as WeeklyMatchupData, live: null, matchup: null, board: null });
    expect(ask).toMatchObject({ start: "2026-11-01", end: "2026-11-14" });
  });
});

describe("withVerdicts", () => {
  const src = sourceFromApi({ week, live: null, matchup: null, board: null });
  const mine = (s: typeof src, id: number) => s.mine.find((p) => p.id === id)!;

  test("no verdicts leaves the week as it was", () => {
    expect(withVerdicts(src, [])).toBe(src);
    expect(withVerdicts(src, undefined)).toBe(src);
  });

  test("our out rules a game out whatever ESPN says; our available clears ESPN's out", () => {
    const s = withVerdicts(src, [verdict(101, "2026-11-11", "out"), verdict(102, "2026-11-11", "available", { decided_by: "nba_report" })]);
    expect(mine(src, 1).games[2]?.out).toBe(false);
    expect(mine(s, 1).games[2]).toMatchObject({ out: true, ruling: { verdict: "out", decidedBy: "espn_injuries", reason: "Left Ankle; Sprain" } });
    expect(mine(src, 2).games[2]?.out).toBe(true);
    expect(mine(s, 2).games[2]).toMatchObject({ out: false, ruling: { verdict: "available", decidedBy: "nba_report" } });
    // No verdict on him: ESPN's word stands.
    expect(src.opponents[0].games[2]?.out).toBe(true);
    expect(s.opponents[0].games[2]).toEqual(src.opponents[0].games[2]);
  });

  test("today's verdict is the player's status; ESPN's own word is kept when it says out with more", () => {
    const s = withVerdicts(src, [verdict(101, "2026-11-10", "questionable"), verdict(102, "2026-11-10", "available"), verdict(109, "2026-11-11", "out")]);
    expect(mine(s, 1).injury).toBe("QUESTIONABLE");
    expect(mine(s, 2).injury).toBe("ACTIVE");
    // Wednesday's verdict rules the game, not today's status.
    expect(s.opponents[0].injury).toBe(src.opponents[0].injury);
    expect(s.opponents[0].games[2]?.out).toBe(true);
    const suspended = { ...src, opponents: src.opponents.map((o) => ({ ...o, injury: "SUSPENSION" })) };
    expect(withVerdicts(suspended, [verdict(109, "2026-11-10", "out")]).opponents[0].injury).toBe("SUSPENSION");
  });

  test("played days and players without an NBA id are left alone", () => {
    const s = withVerdicts(src, [verdict(101, "2026-11-09", "out")]);
    expect(mine(s, 1)).toBe(mine(src, 1));
    expect(mine(s, 5)).toBe(mine(src, 5));
  });

  test("a game under way keeps playing, with the verdict beside it", () => {
    const live = { ...src, mine: src.mine.map((p) => (p.id === 1 ? { ...p, games: p.games.map((g, i) => (i === 1 && g ? { ...g, status: "live" as const } : g)) } : p)) };
    const s = withVerdicts(live, [verdict(101, "2026-11-10", "out")]);
    expect(mine(s, 1).games[1]).toMatchObject({ status: "live", out: false, ruling: { verdict: "out" } });
  });
});

describe("rulingTitle and gridCellTitle", () => {
  const ruling: Ruling = {
    verdict: "out", decidedBy: "espn_injuries", reason: "Left Ankle; Sprain", expectedReturn: null,
    changedAt: "2026-11-10T21:30:00Z",
  };
  const tz = "America/New_York";
  const now = Date.parse("2026-11-10T23:00:00Z");

  test("the verdict, why, who said so and when, in the viewer's zone", () => {
    expect(rulingTitle(ruling, { tz, now })).toBe("Out: Left Ankle; Sprain (ESPN's injury list, 4:30 PM)");
    expect(rulingTitle(ruling, { tz: "America/Chicago", now })).toBe("Out: Left Ankle; Sprain (ESPN's injury list, 3:30 PM)");
    expect(rulingTitle(ruling, { tz, now: Date.parse("2026-11-12T15:00:00Z") })).toBe("Out: Left Ankle; Sprain (ESPN's injury list, Tue 4:30 PM)");
  });

  test("an expected return, an unknown source, and a verdict with nothing beside it", () => {
    expect(rulingTitle({ ...ruling, expectedReturn: "2026-11-20", decidedBy: "nba_report" }, { tz, now }))
      .toBe("Out: Left Ankle; Sprain, back Nov 20 (the NBA injury report, 4:30 PM)");
    expect(rulingTitle({ ...ruling, decidedBy: "rotowire", changedAt: null }, { tz, now })).toBe("Out: Left Ankle; Sprain (rotowire)");
    expect(rulingTitle({ verdict: "probable", decidedBy: null, reason: null, expectedReturn: "2026-11-20", changedAt: null })).toBe("Probable: back Nov 20");
    expect(rulingTitle({ verdict: "available", decidedBy: null, reason: null, expectedReturn: "2026-11-20", changedAt: null })).toBe("Available");
  });

  test("a cell's tooltip: the ruling stands in for 'out', and sits beside a tag", () => {
    const cell = (extra: Partial<GridCell>): GridCell => ({ state: "upcoming", value: 30, opp: "vs BOS", note: "19:30", counts: true, tag: null, ...extra });
    const opts = { tz, now };
    expect(gridCellTitle(cell({ state: "out", counts: false }), opts)).toBe("Out for this game");
    expect(gridCellTitle(cell({ state: "out", counts: false, ruling }), opts)).toBe("Out: Left Ankle; Sprain (ESPN's injury list, 4:30 PM)");
    expect(gridCellTitle(cell({ tag: "BENCH", ruling: { ...ruling, verdict: "questionable" } }), opts))
      .toBe("On the bench: this game doesn't count · Questionable: Left Ankle; Sprain (ESPN's injury list, 4:30 PM)");
    expect(gridCellTitle(cell({}), opts)).toBeUndefined();
    expect(gridCellTitle(cell({ state: "dnp", counts: false, ruling }), opts)).toBe("Didn't play");
    expect(gridCellTitle(cell({ state: "final", value: 30, ruling }), opts)).toBeUndefined();
  });
});

describe("the grid with our verdicts", () => {
  test("a game we rule out is an out cell carrying the ruling, and the best lineup leaves him out", async () => {
    const { buildWeekGrid } = await import("../week-grid");
    const src = withVerdicts(sourceFromApi({ week, live: null, matchup: null, board: null }), [verdict(101, "2026-11-11", "out")]);
    const grid = buildWeekGrid({ source: src, board: null, staged: {}, incoming: null, viewDay: 1, mode: "best" });
    const row = grid.rows.find((r) => r.player?.id === 1)!;
    expect(row.cells[2]).toMatchObject({ state: "out", counts: false, ruling: { verdict: "out", reason: "Left Ankle; Sprain" } });
    expect(row.cells[1].ruling).toBeUndefined();
  });
});
