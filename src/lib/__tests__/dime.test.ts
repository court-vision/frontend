import { describe, expect, test } from "bun:test";
import {
  forecastChange,
  groupNotes,
  isDue,
  retiredLabel,
  sideText,
  signed,
  summaryText,
  windowOf,
  windowResult,
} from "@/lib/dime";
import type { AiNote, MoveOutcome, MoveSourceSummary } from "@/types/ai";

function note(id: number, over: Partial<AiNote> = {}): AiNote {
  return {
    note_id: id, kind: "plan", team_id: null, text: `note ${id}`, recheck_on: null, author: "dime",
    written_on: "2026-11-01", retired_on: null, retired_by: null, retired_reason: null, ...over,
  };
}

describe("notes", () => {
  test("a note is due once its recheck day comes, and never once retired", () => {
    expect(isDue(note(1, { recheck_on: "2026-11-02" }), "2026-11-02")).toBe(true);
    expect(isDue(note(1, { recheck_on: "2026-11-03" }), "2026-11-02")).toBe(false);
    expect(isDue(note(1), "2026-11-02")).toBe(false);
    expect(isDue(note(1, { recheck_on: "2026-11-01", retired_on: "2026-11-02" }), "2026-11-02")).toBe(false);
  });

  test("a retired note says who retired it and how", () => {
    expect(retiredLabel({ retired_by: "dime", retired_reason: "revised" })).toBe("Revised by Dime");
    expect(retiredLabel({ retired_by: "user", retired_reason: "revised" })).toBe("Revised by you");
    expect(retiredLabel({ retired_by: "user", retired_reason: "deleted by the user" })).toBe("Deleted by you");
    expect(retiredLabel({ retired_by: "dime", retired_reason: "he's back" })).toBe("Forgotten by Dime: he's back");
  });

  test("notes group by the user first, then teams in order, live before retired", () => {
    const groups = groupNotes(
      [note(1, { team_id: 24 }), note(2, { team_id: 21, retired_on: "2026-11-01" }), note(3), note(4, { team_id: 21 })],
      [21, 24]
    );
    expect(groups.map((g) => [g.teamId, g.notes.map((n) => n.note_id)])).toEqual([
      [null, [3]],
      [21, [4, 2]],
      [24, [1]],
    ]);
  });
});

function move(windows: Record<string, unknown>, over: Partial<MoveOutcome> = {}): MoveOutcome {
  return {
    move_id: 1, date: "2026-10-25", team_name: "Atlas", mine: true, source: "you", add: null, drop: null,
    paired: true, windows, forecast: null, reason: null, ...over,
  } as MoveOutcome;
}

describe("the move ledger", () => {
  test("a window reads as its net in points, or its categories won and lost", () => {
    const m = move({
      day: { start: "a", end: "a", complete: true, add: null, drop: null, net: 12.5 },
      matchup: { start: "a", end: "b", complete: false, add: null, drop: null, edge: { won: ["pts", "reb"], lost: ["tov"], tied: [] } },
      held_through: "2026-10-27",
    });
    expect(windowResult(windowOf(m, "day"))).toEqual({ text: "+12.5", tone: "up" });
    expect(windowResult(windowOf(m, "matchup"))).toEqual({ text: "2–1", tone: "up" });
    expect(windowOf(m, "two_weeks")).toBeNull();
    expect(windowResult(null)).toBeNull();
    expect(signed(-3)).toBe("−3.0");
    expect(signed(0)).toBe("0.0");
  });

  test("a side names its points, games and starts", () => {
    expect(sideText({ games: 3, points: 41.5, counted_games: 2, counted_points: 30 }, true)).toBe("41.5 pts in 3 games, 2 started here");
    expect(sideText({ games: 1, points: 0 })).toBe("0.0 pts in 1 game");
    expect(sideText({ games: 2, totals: { pts: 30 } })).toBe("2 games");
    expect(sideText(null)).toBe("");
  });

  test("the summary sums each source's settled moves", () => {
    const pts = { source: "dime", moves: 3, settled: 2, net_points: 14.5, ahead: 2, behind: 0 } as MoveSourceSummary;
    expect(summaryText(pts)).toBe("3 moves, 2 settled: +14.5 (2 ahead, 0 behind)");
    expect(summaryText({ ...pts, settled: 0 })).toBe("3 moves, none settled yet");
    const cats = { source: "you", moves: 1, settled: 1, categories_won: 5, categories_lost: 3 } as MoveSourceSummary;
    expect(summaryText(cats)).toBe("1 move, 1 settled: 5–3 in categories");
  });

  test("a forecast is the change the proposal projected", () => {
    expect(forecastChange(move({}, { forecast: { scoring: "points", change: 6.5 } }))).toBe(6.5);
    expect(forecastChange(move({}))).toBeNull();
  });
});
