import { describe, expect, test } from "bun:test";
import { buildRace, categoryLeader, categoryRace, categoryRacePoints, leadChanges, marginText, type RacePoint } from "../matchup-race";
import type { DayTotal, MatchupCategory, WeekDay } from "../week-grid";
import type { DailyScorePoint } from "../../types/matchup";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function week(today: number | null): WeekDay[] {
  return DOW.map((dow, index) => ({
    index,
    date: `2026-11-${String(9 + index).padStart(2, "0")}`,
    dow,
    kind: today == null ? "past" : index < today ? "past" : index === today ? "today" : "future",
  }));
}

const total = (actual: number | null, projected: number | null): DayTotal => ({ actual, projected, starts: 0 });

function snap(day: number, you: number, opp: number, cats?: { you: Record<string, number>; opp: Record<string, number> }): DailyScorePoint {
  return {
    date: `2026-11-${String(9 + day).padStart(2, "0")}`,
    day_of_matchup: day,
    your_score: you,
    opponent_score: opp,
    your_categories: cats?.you ?? null,
    opponent_categories: cats?.opp ?? null,
  };
}

describe("buildRace", () => {
  // Wednesday is today: Mon and Tue are done, 40 + 35 for you and 30 + 50 for them.
  const days = week(2);
  const you = [total(40, 40), total(35, 35), total(12, 50), total(null, 45), total(null, 40), total(null, 0), total(null, 30)];
  const opp = [total(30, 30), total(50, 50), total(20, 44), total(null, 38), total(null, 41), total(null, 20), total(null, 25)];

  test("finished days take ESPN's snapshots (dated the morning after), today is live, the rest projected", () => {
    const race = buildRace({ days, you, opp, now: { you: 87, opp: 100 }, history: [snap(0, 0, 0), snap(1, 41, 30), snap(2, 75, 80)] });
    expect(race.points.map((p) => [p.x, p.you, p.opp, p.kind, p.from])).toEqual([
      [0, 0, 0, "start", null],
      [1, 41, 30, "final", "espn"],
      [2, 75, 80, "final", "espn"],
      [2.5, 87, 100, "now", null],
      [3, 125, 124, "projected", null],
      [4, 170, 162, "projected", null],
      [5, 210, 203, "projected", null],
      [6, 210, 223, "projected", null],
      [7, 240, 248, "projected", null],
    ]);
    expect(race.fromEspn).toBe(2);
    expect(race.end.margin).toBe(-8);
    // A day's own points: the snapshot's difference, ESPN's word over the week's.
    expect(race.days[0]).toMatchObject({ you: 41, opp: 30, margin: 11, projected: false });
    expect(race.days[2]).toMatchObject({ you: 50, opp: 44, margin: 1, projected: true });
  });

  test("without a snapshot a finished day falls back to the week's own totals", () => {
    const race = buildRace({ days, you, opp, now: { you: 87, opp: 100 }, history: [snap(1, 41, 30)] });
    expect(race.points[2]).toMatchObject({ x: 2, you: 76, opp: 80, from: "week" });
    expect(race.fromEspn).toBe(1);
  });

  test("the widest leads and where the lead changed hands", () => {
    const race = buildRace({ days, you, opp, now: { you: 87, opp: 100 }, history: [snap(1, 41, 30), snap(2, 75, 80)] });
    expect(race.best.you).toMatchObject({ x: 1, margin: 11 });
    expect(race.best.opp).toMatchObject({ x: 2.5, margin: -13 });
    expect(race.changes.map((c) => [c.to, c.day, c.projected])).toEqual([
      ["opp", 1, false],
      ["you", 2, true],
      ["opp", 5, true],
    ]);
    // Tuesday: +11 to −5, so zero is crossed 11/16 of the way through.
    expect(race.changes[0].x).toBeCloseTo(1.69, 2);
  });

  test("before the week starts it is all projection; after it ends, all finals", () => {
    const ahead = buildRace({ days: week(-1).map((d) => ({ ...d, kind: "future" as const })), you, opp, now: { you: 0, opp: 0 }, history: null });
    expect(ahead.points.every((p) => p.kind === "start" || p.kind === "projected")).toBe(true);
    expect(ahead.best).toEqual({ you: null, opp: null });
    const done = buildRace({ days: week(null), you, opp, now: { you: 0, opp: 0 }, history: null });
    expect(done.points.slice(1).every((p) => p.kind === "final" && p.from === "week")).toBe(true);
  });
});

describe("leadChanges", () => {
  const p = (x: number, margin: number, kind: RacePoint["kind"] = "final"): RacePoint => ({ x, you: margin, opp: 0, margin, kind, from: null });

  test("a tie is not a lead: the change is counted when the other side goes ahead, at the tie", () => {
    expect(leadChanges([p(0, 0, "start"), p(1, 5), p(2, 0), p(3, -4)])).toEqual([{ x: 2, day: 1, to: "opp", projected: false }]);
    expect(leadChanges([p(0, 0, "start"), p(1, 5), p(2, 0), p(3, 6)])).toEqual([]);
    expect(leadChanges([p(0, 0, "start"), p(1, -5)])).toEqual([]);
  });
});

describe("the category race", () => {
  const CATS: MatchupCategory[] = [
    { key: "pts", label: "PTS", higherIsBetter: true, isRate: false },
    { key: "tov", label: "TO", higherIsBetter: false, isRate: false },
    { key: "fg_pct", label: "FG%", higherIsBetter: true, isRate: true },
  ];

  test("a category's leader follows its direction; ties and gaps are said", () => {
    expect(categoryLeader(CATS[0], 100, 90)).toBe("you");
    expect(categoryLeader(CATS[1], 10, 12)).toBe("you");
    expect(categoryLeader(CATS[1], 12, 10)).toBe("opp");
    expect(categoryLeader(CATS[2], 0.5, 0.5)).toBe("tie");
    expect(categoryLeader(CATS[0], null, 3)).toBeNull();
  });

  test("finished days from snapshots (a day without one is left out), today from the live week", () => {
    const history = [
      snap(1, 2, 1, { you: { pts: 100, tov: 10, fg_pct: 0.5 }, opp: { pts: 90, tov: 12, fg_pct: 0.52 } }),
      // No snapshot for the end of Tuesday.
    ];
    const live = [
      { key: "pts", you: 250, opp: 260 },
      { key: "tov", you: 30, opp: 30 },
      { key: "fg_pct", you: 0.48, opp: 0.47 },
    ];
    const cols = categoryRace(CATS, week(2), history, live);
    expect(cols.map((c) => [c.day, c.kind, c.won, c.lost, c.tied])).toEqual([
      [0, "final", 2, 1, 0],
      [2, "now", 1, 1, 1],
    ]);
    expect(cols[0].cells.tov.leader).toBe("you");
    const race = categoryRacePoints(cols);
    expect(race.points.map((pt) => [pt.x, pt.margin, pt.kind])).toEqual([
      [0, 0, "start"],
      [1, 1, "final"],
      [2.5, 0, "now"],
    ]);
    expect(race.end.kind).toBe("now");
  });
});

test("margins read with a real minus, and even when level", () => {
  expect(marginText(12.46)).toBe("+12.5");
  expect(marginText(-3)).toBe("−3.0");
  expect(marginText(0.01)).toBe("even");
  expect(marginText(2, 0)).toBe("+2");
});
