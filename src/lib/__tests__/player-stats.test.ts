import { describe, expect, test } from "bun:test";
import { opponentAsPlayer, weekSummary } from "../player-stats";
import type { DayGame, SourcePlayer, WeekDay } from "../week-grid";

const days: WeekDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((dow, index) => ({
  index,
  date: `2026-11-0${index + 2}`,
  dow,
  kind: index < 2 ? "past" : index === 2 ? "today" : "future",
}));

const game = (over: Partial<DayGame> = {}): DayGame => ({
  opp: "vs LAL",
  time: "19:30",
  status: "scheduled",
  fpts: null,
  clock: null,
  remaining: 1,
  out: false,
  ...over,
});

const player = (games: Array<DayGame | null>, avg = 30): SourcePlayer => ({
  id: 1,
  name: "P One",
  team: "DEN",
  nbaId: 100,
  avg,
  injury: null,
  eligible: [],
  games,
});

describe("weekSummary", () => {
  test("counts finals and a live game as played, games to tip as left", () => {
    const p = player([game({ status: "final", fpts: 40 }), null, game({ status: "live", fpts: 12.5, remaining: 0.5 }), game(), game()]);
    expect(weekSummary(p, days, 2)).toEqual({ played: 2, scored: 52.5, left: 2, projected: 60 });
  });

  test("a game ruled out counts neither way", () => {
    const p = player([null, null, game({ out: true }), game(), null]);
    expect(weekSummary(p, days, 2)).toEqual({ played: 0, scored: 0, left: 1, projected: 30 });
  });

  test("a scheduled game before today (no box score came) is not left", () => {
    const p = player([game(), null, null, game(), null]);
    expect(weekSummary(p, days, 2).left).toBe(1);
  });

  test("outside the period every scheduled game is left", () => {
    const p = player([game(), null, game(), null, game()], 20);
    expect(weekSummary(p, days, null)).toEqual({ played: 0, scored: 0, left: 3, projected: 60 });
  });
});

describe("opponentAsPlayer", () => {
  test("keeps his games and fills what the opponent's roster leaves out", () => {
    const games = [null, game()];
    expect(opponentAsPlayer({ id: 7, name: "O Seven", avg: 25, active: true, games })).toEqual({
      id: 7,
      name: "O Seven",
      team: "",
      nbaId: null,
      avg: 25,
      injury: null,
      eligible: [],
      games,
    });
  });
});
