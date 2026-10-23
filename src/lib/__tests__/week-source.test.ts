import { describe, expect, test } from "bun:test";
import { ApiError } from "../api-error";
import { currentFallback, racePeriod, sourceFromApi, sourceFromStreamer, weekBehindBoard } from "../week-source";
import type { LiveMatchupData, MatchupData, WeeklyMatchupData } from "../../types/matchup";
import type { StreamerPlayer } from "../../types/streamer";
import * as F from "./week-api-fixtures";

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

// Live carries both whole rosters, as /matchups/current does (the server builds one from the other).
const live = {
  your_team: {
    team_name: "Mine", current_score: 61, projected_score: 0, team_id: 1,
    roster: [
      { player_id: 1, name: "P1", team: "DEN", lineup_slot: "C", avg_points: 50, live: { game_status: 2, period: 3, game_clock: "PT04M12.00S", live_fpts: 20.5 } },
      { player_id: 2, name: "P2", team: "DEN", avg_points: 22, position: "PF", lineup_slot: "BE", live: null },
    ],
  },
  opponent_team: {
    team_name: "Theirs", current_score: 42, projected_score: 0, team_id: 2,
    roster: [{ player_id: 9, name: "P9", team: "MIA", lineup_slot: "BE", avg_points: 31, position: "SG", live: null }],
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

// ---------------------------------------------------------------------------
// The live matchup's rows stand for /matchups/current's
// ---------------------------------------------------------------------------

/** Projections, eligibility and who is on each side: everything but tonight's games. */
const roster = (src: ReturnType<typeof sourceFromApi>) => ({
  mine: src.mine.map(({ games: _g, ...p }) => p),
  opponents: src.opponents.map(({ games: _g, ...p }) => p),
});

describe("sourceFromApi without /matchups/current", () => {
  const cur = F.current();
  const boxes = { [F.MINE[0].id]: F.liveStats(203999, 2, 31.5), [F.THEIRS[1].id]: F.liveStats(1641706, 3, 22) };
  const lv = F.live(cur, boxes);
  const week = F.weekOf();
  const board = F.espnBoard(F.TODAY, { now: "19:40" });

  test("an ESPN team's players project at their live row's average until the board loads", () => {
    const src = sourceFromApi({ week, live: lv, matchup: undefined, board: null });
    for (const spec of F.MINE) {
      const p = src.mine.find((m) => m.id === spec.id)!;
      expect(p.avg).toBe(spec.avg);
      expect(p.nbaId).toBe(spec.nbaId);
    }
    // Eligibility from the live row's position: Jokic (C) can sit at C or UT.
    expect(src.mine.find((m) => m.id === F.MINE[0].id)!.eligible).toEqual([4, 11]);
  });

  test("the source is the one /matchups/current used to give, overlay included", () => {
    const both = sourceFromApi({ week, live: lv, matchup: cur, board });
    const liveOnly = sourceFromApi({ week, live: lv, matchup: undefined, board });
    expect(liveOnly).toEqual(both);
    expect(liveOnly.mine.find((p) => p.id === F.MINE[0].id)!.games[F.TODAY]).toMatchObject({ status: "live", fpts: 31.5 });
    expect(liveOnly.opponents.find((p) => p.id === F.THEIRS[1].id)!.games[F.TODAY]).toMatchObject({ status: "final", fpts: 22 });
  });

  test("with live failed, /current stands in with the same rosters and projections", () => {
    const fromLive = sourceFromApi({ week, live: F.live(cur), matchup: undefined, board: null });
    const fromCurrent = sourceFromApi({ week, live: undefined, matchup: cur, board: null });
    expect(roster(fromCurrent)).toEqual(roster(fromLive));
    expect(fromCurrent.opponents.map((p) => p.games)).toEqual(fromLive.opponents.map((p) => p.games));
  });

  test("live's rows win over an older /current read", () => {
    // Since /current was read, the opponent started Zion (BE → PF) and his average moved.
    const older = F.current({ theirs: F.THEIRS.map((s) => (s.id === F.THEIRS[2].id ? { ...s, slot: "BE", avg: 30 } : s)) });
    const newer = F.live(F.current({ theirs: F.THEIRS.map((s) => (s.id === F.THEIRS[2].id ? { ...s, slot: "PF" } : s)) }));
    const zion = sourceFromApi({ week, live: newer, matchup: older, board }).opponents.find((p) => p.id === F.THEIRS[2].id)!;
    expect(zion).toMatchObject({ slot: "PF", active: true, avg: F.THEIRS[2].avg });
  });

  test("players only the live matchup knows (added after the week was read) are on both sides", () => {
    const added: F.Spec = { ...F.MINE[3], id: 4594327, nbaId: 1641708, name: "Sample Pickup", team: "CHA", position: "SG", avg: 27.4 };
    const signed: F.Spec = { ...F.THEIRS[1], id: 4701230, nbaId: 1642000, name: "Sample Signing", team: "UTA", avg: 18.9 };
    const lvMore = F.live(F.current({ mine: [...F.MINE, added], theirs: [...F.THEIRS, signed] }));
    const src = sourceFromApi({ week, live: lvMore, matchup: undefined, board: null });
    expect(src.mine.find((p) => p.id === added.id)).toMatchObject({ name: "Sample Pickup", avg: 27.4, team: "CHA" });
    expect(src.opponents.find((p) => p.id === signed.id)).toMatchObject({ name: "Sample Signing", avg: 18.9, active: true });
    expect(src.mine).toHaveLength(F.MINE.length + 1);
    expect(src.opponents).toHaveLength(F.THEIRS.length + 1);
  });

  test("a categories league reads its format and categories from live", () => {
    const catCur = F.current({ categories: true });
    const src = sourceFromApi({ week: F.weekOf({ categories: true }), live: F.live(catCur), matchup: undefined, board });
    expect(src.format).toBe("categories");
    expect(src.categories?.map((c) => c.key)).toEqual(["fg_pct", "ft_pct", "fg3m", "pts", "reb", "ast", "stl", "blk", "tov"]);
    expect(src.weekCategories?.find((c) => c.key === "reb")).toEqual({ key: "reb", you: 151, opp: 133 });
    expect(src.opponents.find((p) => p.id === F.THEIRS[0].id)).toMatchObject({ avg: F.THEIRS[0].avg, injury: "OUT", active: true });
  });

  test("a Yahoo team (no board) projects and seats every player from live", () => {
    const yCur = F.current({ mine: F.YAHOO_MINE, theirs: F.YAHOO_THEIRS });
    const yWeek = F.weekOf({ mine: F.YAHOO_MINE, theirs: F.YAHOO_THEIRS });
    const src = sourceFromApi({ week: yWeek, live: F.live(yCur), matchup: undefined, board: null });
    expect(src.mine.map((p) => [p.id, p.avg])).toEqual(F.YAHOO_MINE.map((s) => [s.id, s.avg]));
    // SGA is a PG to Yahoo: PG, G and UT.
    expect(src.mine.find((p) => p.id === 6450)!.eligible).toEqual([0, 5, 11]);
    // Yahoo's IL and BN are inactive slots; PF is active.
    expect(src.opponents.map((p) => [p.id, p.active])).toEqual([[5826, false], [6513, true]]);
    expect(src.activeSlotCount).toBe(10);
    expect(roster(src)).toEqual(roster(sourceFromApi({ week: yWeek, live: undefined, matchup: yCur, board: null })));
  });
});

describe("each day's own ESPN roster", () => {
  // After Wednesday's first tip Banchero was dropped for a pickup: ESPN has the swap on
  // Thursday's board and every later one, Wednesday's as it was.
  const pickup: F.Spec = { ...F.MINE[3], id: 4594327, nbaId: 1641708, name: "Sample Pickup", team: "CHA", avg: 27.4,
    tips: [null, null, "19:00", "19:30", null, "20:00", null] };
  const later = [...F.MINE.filter((s) => s.id !== F.MINE[3].id), pickup];
  const boards = F.DATES.map((_, i) => (i < F.TODAY ? undefined : F.espnBoard(i, { roster: i === F.TODAY ? F.MINE : later })));
  const src = sourceFromApi({ week: F.weekOf(), live: F.live(F.current()), matchup: undefined, board: boards[F.TODAY], boards });

  test("a player only a later day's board lists is arriving, with that board's games, and not in mine", () => {
    expect(src.mine.map((p) => p.id)).not.toContain(pickup.id);
    expect(src.arriving?.map((p) => [p.id, p.name, p.avg, p.nbaId])).toEqual([[pickup.id, "Sample Pickup", 27.4, 1641708]]);
    const games = src.arriving![0].games;
    expect(games[F.TODAY]).toBeNull();                          // not on today's roster
    expect(games[3]).toMatchObject({ status: "scheduled", opp: "@ LAL", time: "19:30" });
    expect(games[4]).toBeNull();
  });

  test("who is on the roster each day: today's board today, each later day's own from then", () => {
    expect(src.onRoster?.[F.TODAY]?.has(F.MINE[3].id)).toBe(true);
    expect(src.onRoster?.[3]?.has(F.MINE[3].id)).toBe(false);
    expect(src.onRoster?.[3]?.has(pickup.id)).toBe(true);
    expect(src.onRoster?.slice(0, F.TODAY)).toEqual([null, null]);   // played days have their own record
  });

  test("without the days' boards (Yahoo, the demo) today's roster stands for every day", () => {
    const flat = sourceFromApi({ week: F.weekOf(), live: F.live(F.current()), matchup: undefined, board: boards[F.TODAY] });
    expect(flat.onRoster).toBeUndefined();
    expect(flat.arriving).toEqual([]);
  });
});

describe("racePeriod", () => {
  test("the preseason week (every day ahead) has no history to ask for", () => {
    expect(racePeriod(F.weekOf({ today: -1 }))).toBeNull();
  });

  test("nor does a period's first day, before any day is finished", () => {
    expect(racePeriod(F.weekOf({ today: 0 }))).toBeNull();
  });

  test("once a day is played, the period's snapshots are asked for", () => {
    expect(racePeriod(F.weekOf())).toBe(F.PERIOD);
    expect(racePeriod(undefined)).toBeNull();
  });
});

describe("currentFallback", () => {
  const failed = new ApiError({ message: "Request failed (HTTP 500)", status: 500 });

  test("live failed with nothing to show: the current matchup stands in", () => {
    expect(currentFallback({ isError: true, data: undefined, error: failed })).toBe(true);
    expect(currentFallback({ isError: true, data: undefined, error: ApiError.network(new Error("offline")) })).toBe(true);
  });

  test("an empty week is an answer, not a failure: current would answer the same", () => {
    expect(currentFallback({ isError: true, data: undefined, error: ApiError.empty({ message: "No matchup" }) })).toBe(false);
  });

  test("a failed poll after a good answer keeps live's rows on screen", () => {
    expect(currentFallback({ isError: true, data: F.live(F.current()), error: failed })).toBe(false);
  });

  test("loading, or answered: never", () => {
    expect(currentFallback({ isError: false, data: undefined, error: null })).toBe(false);
    expect(currentFallback({ isError: false, data: F.live(F.current()), error: null })).toBe(false);
  });
});

describe("a finished day on record", () => {
  // Yesterday (day 1) as it stood: Haliburton at PG, a since-dropped guard at UT,
  // Banchero on the bench; nobody else was on it.
  const cut: F.Spec = { ...F.MINE[1], id: 9001, nbaId: 9001, name: "Cut Guard", slot: "UT", slotId: 11 };
  const stood = (spec: F.Spec, slotId: number) => ({
    player_id: spec.id, nba_player_id: spec.nbaId, name: spec.name, team: spec.team, position: spec.position,
    had_game: true, lineup_slot: null, lineup_slot_id: slotId, injury_status: null,
    fpts: 20, pts: 10, reb: 5, ast: 2, stl: 1, blk: 0, tov: 1, min: 30, fgm: 4, fga: 9, fg3m: 1, fg3a: 3, ftm: 1, fta: 2,
  });
  const week = F.weekOf();
  const yesterday = week.days[1];
  const dated = {
    ...week,
    days: week.days.map((d, i) =>
      i !== 1
        ? d
        : {
            ...yesterday,
            your_team: {
              ...yesterday.your_team,
              roster_source: "snapshot" as const,
              total_fpts: 40,
              roster: [stood(F.MINE[1], 0), stood(cut, 11), stood(F.MINE[3], 12)],
            },
          }
    ),
  } as WeeklyMatchupData;
  const src = sourceFromApi({ week: dated, live: F.live(F.current()), matchup: undefined, board: F.espnBoard() });

  test("carries each player's slot that day; a day with no record carries none", () => {
    expect([...src.pastLineups!.you[1]!]).toEqual([[F.MINE[1].id, 0], [cut.id, 11], [F.MINE[3].id, 12]]);
    expect(src.pastLineups!.you[0]).toBeNull();
    expect(src.pastLineups!.opp[1]).toBeNull();
    expect(src.pastLineups!.you[F.TODAY]).toBeNull();
    expect(src.pastTotals.you[1]).toBe(40);
  });

  test("ESPN's slots past IR (14/15) sit with the bench", () => {
    const odd = {
      ...dated,
      days: dated.days.map((d, i) =>
        i !== 1 ? d : { ...d, your_team: { ...d.your_team, roster: [stood(F.MINE[1], 0), stood(F.MINE[3], 14), stood(F.MINE[2], 13)] } }
      ),
    } as WeeklyMatchupData;
    const s = sourceFromApi({ week: odd, live: F.live(F.current()), matchup: undefined, board: F.espnBoard() });
    expect([...s.pastLineups!.you[1]!]).toEqual([[F.MINE[1].id, 0], [F.MINE[3].id, 12], [F.MINE[2].id, 13]]);
  });

  test("one dropped since and back after today's first tip is arriving, keeping the day he played", () => {
    const boards = F.DATES.map((_, i) => (i < F.TODAY ? undefined : F.espnBoard(i, { roster: i === F.TODAY ? F.MINE : [...F.MINE, cut] })));
    const back = sourceFromApi({ week: dated, live: F.live(F.current()), matchup: undefined, board: boards[F.TODAY], boards });
    expect(back.gone!.mine.map((p) => p.id)).toEqual([]);
    expect(back.mine.map((p) => p.id)).not.toContain(cut.id);
    const games = back.arriving!.find((p) => p.id === cut.id)!.games;
    expect(games[1]).toMatchObject({ status: "final", fpts: 20 });        // his day on record
    expect(games[F.TODAY]).toBeNull();                                     // not on today's roster
    expect(games[4]).toMatchObject({ status: "scheduled", time: "19:00" }); // from that day's board
  });

  test("a player dropped since is gone, off the roster, and plays only that day; one added since has no game there", () => {
    expect(src.gone!.mine.map((p) => p.id)).toEqual([cut.id]);
    expect(src.mine.some((p) => p.id === cut.id)).toBe(false);
    const gone = src.gone!.mine[0];
    expect(gone.games[1]).toMatchObject({ status: "final", fpts: 20 });
    expect(gone.games.filter(Boolean)).toHaveLength(1);
    expect(src.gone!.opp).toEqual([]);
    // Sengun's team played that day, but he wasn't on the roster.
    expect(F.MINE[5].tips[1]).not.toBeNull();
    expect(src.mine.find((p) => p.id === F.MINE[5].id)!.games[1]).toBeNull();
  });
});

describe("the board on another day than the week's today", () => {
  test("ESPN rolled past the week's today: its games don't paint that day", () => {
    const week = F.weekOf();
    const jokic = F.MINE[0];          // plays today (19:00), not tomorrow
    const rolled = sourceFromApi({ week, live: undefined, matchup: F.current(), board: F.espnBoard(F.TODAY + 1) });
    expect(rolled.mine.find((p) => p.id === jokic.id)!.games[F.TODAY]).toMatchObject({ status: "scheduled" });
    const banchero = F.MINE[3];       // plays tomorrow, not today
    expect(rolled.mine.find((p) => p.id === banchero.id)!.games[F.TODAY]).toBeNull();
    const same = sourceFromApi({ week, live: undefined, matchup: F.current(), board: F.espnBoard(F.TODAY) });
    expect(same.mine.find((p) => p.id === jokic.id)!.games[F.TODAY]).toMatchObject({ status: "scheduled", time: "19:00" });
  });

  test("live rows for another day (last night's, until the post-game run) don't paint today", () => {
    const week = F.weekOf();
    const jokic = F.MINE[0];
    const box = { [jokic.id]: F.liveStats(jokic.nbaId!, 3, 31.5) };
    const lastNight = { ...F.live(F.current(), box), game_date: F.DATES[F.TODAY - 1] };
    const stale = sourceFromApi({ week, live: lastNight, matchup: undefined, board: F.espnBoard(F.TODAY) });
    expect(stale.mine.find((p) => p.id === jokic.id)!.games[F.TODAY]).toMatchObject({ status: "scheduled", fpts: null });
    const tonight = sourceFromApi({ week, live: F.live(F.current(), box), matchup: undefined, board: F.espnBoard(F.TODAY) });
    expect(tonight.mine.find((p) => p.id === jokic.id)!.games[F.TODAY]).toMatchObject({ status: "final", fpts: 31.5 });
  });

  test("weekBehindBoard: the week calls an earlier day today than the board is on", () => {
    const week = F.weekOf();
    expect(weekBehindBoard(week, F.DATES[F.TODAY + 1])).toBe(true);
    expect(weekBehindBoard(week, F.DATES[F.TODAY])).toBe(false);
    expect(weekBehindBoard(week, F.DATES[F.TODAY - 1])).toBe(false);
    expect(weekBehindBoard(week, null)).toBe(false);
    expect(weekBehindBoard(undefined, F.DATES[0])).toBe(false);
    // The period is over on the week's read and ESPN has moved into the next one.
    const over = F.weekOf({ today: 7 });
    expect(weekBehindBoard(over, "2026-11-02")).toBe(true);
    expect(weekBehindBoard(over, F.DATES[6])).toBe(false);
    // Before the season every day is ahead, and the board names opening night.
    expect(weekBehindBoard(F.weekOf({ today: -1 }), F.DATES[0])).toBe(false);
  });
});
