import { describe, expect, test } from "bun:test";
import { buildTape, myUpcoming, snakeSeat } from "../draft-tape";
import {
  demoAdvance,
  demoBoard,
  demoIdFromSlug,
  demoPick,
  demoRecap,
  demoSession,
  demoSlug,
  demoUndo,
  keeperPick,
  newDemoRoom,
  type DemoFixture,
} from "../draft-demo";
import points from "@/__fixtures__/draft-demo/points.json";
import categories from "@/__fixtures__/draft-demo/categories.json";

const POINTS = points as unknown as DemoFixture;
const CATS = categories as unknown as DemoFixture;

describe("snakeSeat", () => {
  test("odd rounds run forward, even rounds back", () => {
    expect(snakeSeat(1, 10)).toEqual({ round: 1, seat: 1 });
    expect(snakeSeat(10, 10)).toEqual({ round: 1, seat: 10 });
    expect(snakeSeat(11, 10)).toEqual({ round: 2, seat: 10 });
    expect(snakeSeat(20, 10)).toEqual({ round: 2, seat: 1 });
    expect(snakeSeat(21, 10)).toEqual({ round: 3, seat: 1 });
  });
});

describe("buildTape", () => {
  test("marks made picks, the pick on the clock and my turns", () => {
    let room = newDemoRoom(-1, { format: "points", size: 10, rounds: 13, mySlot: 4 });
    room = demoAdvance(room, POINTS, "my_turn").room;
    const tape = buildTape(demoSession(room, POINTS));
    expect(tape).toHaveLength(130);
    expect(tape.slice(0, 3).every((c) => c.state === "made")).toBe(true);
    expect(tape[3]).toMatchObject({ overall: 4, state: "now", seat: 4, mine: true });
    // Seat 4 picks 4th in round 1 and 7th in round 2 (17).
    expect(myUpcoming(tape, 2)).toEqual([4, 17]);
  });

  test("defers to the server's next pick when the geometry disagrees", () => {
    const session = demoSession(newDemoRoom(-1, { format: "points", size: 10, rounds: 2, mySlot: 4 }), POINTS);
    const tape = buildTape({ ...session, my_next_pick: 5 });
    expect(tape.filter((c) => c.mine).map((c) => c.overall)).toEqual([5]);
  });

  test("a room with no length shows the recorded picks and the next one", () => {
    const session = demoSession(newDemoRoom(-1, { format: "points", size: 10, rounds: 2, mySlot: 4 }), POINTS);
    const tape = buildTape({ ...session, total_picks: null, league_size: null, draft_type: "auction" });
    expect(tape).toHaveLength(1);
    expect(tape[0]).toMatchObject({ overall: 1, state: "now", seat: null });
  });
});

describe("demo room", () => {
  test("slugs round-trip and never collide with real ids", () => {
    expect(demoSlug(-3)).toBe("demo-3");
    expect(demoIdFromSlug("demo-3")).toBe(-3);
    expect(demoIdFromSlug("42")).toBeNull();
  });

  test("a pick leaves the board and lands on my roster", () => {
    const room = newDemoRoom(-1, { format: "points", size: 10, rounds: 13, mySlot: 1 });
    const top = POINTS.rows[0];
    const { room: after, overall } = demoPick(room, POINTS, { player_id: top.player_id, by_me: true, source: "manual" } as never);
    expect(overall).toBe(1);
    const board = demoBoard(after, POINTS, "espn");
    expect(board.rows.some((r) => r.player_id === top.player_id)).toBe(false);
    expect(board.roster.map((r) => r.player_id)).toEqual([top.player_id]);
    expect(() => demoPick(after, POINTS, { player_id: top.player_id, by_me: false } as never)).toThrow();
    expect(demoBoard(demoUndo(after, 1), POINTS, "espn").rows).toHaveLength(POINTS.rows.length);
  });

  test("sim to my pick stops on the clock; sim to end completes the draft", () => {
    const room = newDemoRoom(-1, { format: "points", size: 8, rounds: 4, mySlot: 3 });
    const toMe = demoAdvance(room, POINTS, "my_turn");
    expect(toMe.result).toMatchObject({ picks_made: 2, stopped_reason: "my_turn", stopped_at: 3 });
    expect(toMe.result.session.picks_until_my_turn).toBe(0);
    const end = demoAdvance(toMe.room, POINTS, "end");
    expect(end.result.completed).toBe(true);
    expect(end.result.session.pick_count).toBe(32);
    expect(end.result.session.picks.filter((p) => p.by_me)).toHaveLength(4);
  });

  test("the board's order follows the source asked for", () => {
    const room = newDemoRoom(-1, { format: "points", size: 10, rounds: 13, mySlot: 4 });
    const cv = demoBoard(room, POINTS, "cv");
    expect(cv.meta?.rank_basis).toBe("cv");
    expect(cv.rows.every((r) => r.board_rank === r.cv_rank)).toBe(true);
    const mine = demoBoard(room, POINTS, "my_team");
    expect(mine.rows.find((r) => r.board_rank === 1)?.player_id).toBe(mine.recommendations[0].player_id);
  });

  test("availability reads ADP against my next pick", () => {
    const room = newDemoRoom(-1, { format: "points", size: 10, rounds: 13, mySlot: 10 });
    const board = demoBoard(room, POINTS, "espn");
    expect(board.rows[0].availability).toBe("gone");
    expect(board.rows.at(-1)?.availability).toBe("likely");
  });

  test("a keeper costs my pick in its round", () => {
    const room = newDemoRoom(-1, { format: "points", size: 10, rounds: 13, mySlot: 4 });
    expect(keeperPick(room, 1)).toBe(4);
    expect(keeperPick(room, 2)).toBe(17);
    expect(keeperPick(room, 14)).toBeNull();
  });

  test("categories: need, punts and fit move with the roster", () => {
    let room = newDemoRoom(-1, { format: "categories", size: 10, rounds: 13, mySlot: 1 });
    room = demoAdvance(room, CATS, "end").room;
    const board = demoBoard({ ...room, status: "active" }, CATS, "espn");
    expect(board.meta?.category_need).toHaveLength(9);
    expect(board.meta?.category_need.every((n) => n.my_rank != null)).toBe(true);
    const punted = demoBoard({ ...room, status: "active", punts: ["ft_pct"] }, CATS, "espn");
    expect(punted.meta?.category_need.find((n) => n.key === "ft_pct")).toMatchObject({ punted: true, weight: 0 });
  });

  test("the recap grades every seat and projects the standings", () => {
    const room = demoAdvance(newDemoRoom(-1, { format: "categories", size: 6, rounds: 5, mySlot: 2 }), CATS, "end").room;
    const recap = demoRecap(room, CATS);
    expect(recap.picks).toHaveLength(30);
    expect(recap.seats.map((s) => s.position).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(recap.seats.find((s) => s.is_me)?.slot).toBe(2);
    expect(recap.standings.every((s) => s.categories.length === 9 && s.h2h.length === 5)).toBe(true);
    expect(recap.meta?.complete).toBe(true);
  });
});
