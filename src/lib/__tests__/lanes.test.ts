import { describe, expect, test } from "bun:test";
import { demoLanePlan, eventLine, laneCells, laneMarks, laneMovedRoster, laneReason, laneStretches, passedDates, projectedSource } from "../lanes";
import type { LanePlayer, LaneProjection, StreamLane, StreamLaneEvent } from "@/types/stream-lane";
import type { SourcePlayer, WeekDay } from "../week-grid";
import { DEMO_STREAMERS, demoSource } from "../week-demo";

const DATES = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"];
const DAYS: WeekDay[] = DATES.map((date, index) => ({
  index,
  date,
  dow: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index],
  kind: index < 1 ? "past" : index === 1 ? "today" : "future",
}));
const P = (id: number, name: string): LanePlayer => ({ player_id: id, name, team: "LAL", nba_player_id: null });
const HOLDER = P(1, "Holder");
const A = P(2, "Alpha");
const B = P(3, "Bravo");

function projection(from: number, players: LanePlayer[]): LaneProjection {
  let prev = HOLDER.player_id;
  return {
    as_of: "2026-11-17T23:00:00Z",
    value: 100,
    hold_value: 60,
    gain: 40,
    adds: 2,
    adds_left: 3,
    rehold_after: 2,
    days: players.map((player, i) => {
      const day = { scoring_period_id: 28 + from + i, nba_date: DATES[from + i], player, value: 20, switch: player.player_id !== prev };
      prev = player.player_id;
      return day;
    }),
  };
}

let nextId = 1;
function event(action: StreamLaneEvent["action"], date: string | null, over: Partial<StreamLaneEvent> = {}): StreamLaneEvent {
  return {
    id: nextId++,
    action,
    nba_date: date,
    scoring_period_id: null,
    add: null,
    drop: null,
    projected: null,
    reason: null,
    detail: null,
    pickup_id: null,
    pickup_status: null,
    created_at: "2026-11-17T23:00:00Z",
    ...over,
  };
}

function lane(events: StreamLaneEvent[], proj: LaneProjection | null): StreamLane {
  return {
    id: 7,
    team_id: 21,
    status: "active",
    notify: "email",
    holder: HOLDER,
    original: HOLDER,
    start_period: 29,
    end_period: 34,
    end_date: DATES[6],
    next_period: 31,
    next_decision_at: null,
    reason: null,
    detail: null,
    projection: proj,
    events,
    created_at: "2026-11-16T20:00:00Z",
    ended_at: null,
  };
}

describe("laneCells", () => {
  test("decided days from the events, the rest from the projection", () => {
    const cells = laneCells(
      lane(
        [
          event("started", DATES[1]),
          event("keep", DATES[1]),
          event("switch", DATES[2], { add: A, drop: HOLDER, pickup_id: 5, pickup_status: "executed" }),
        ],
        projection(2, [A, A, B, B, B])
      ),
      DAYS
    );
    expect(cells[0]).toBeNull();
    expect(cells[1]).toMatchObject({ state: "kept", player: { name: "Holder" }, switch: false });
    expect(cells[2]).toMatchObject({ state: "made", player: { name: "Alpha" }, switch: true, value: 20 });
    expect(cells[3]).toMatchObject({ state: "projected", player: { name: "Alpha" }, switch: false });
    expect(cells[4]).toMatchObject({ state: "projected", player: { name: "Bravo" }, switch: true });
  });

  test("a pending switch, one that didn't go through, and a missed day", () => {
    const cells = laneCells(
      lane(
        [
          event("blocked", DATES[1], { reason: "missed", detail: "No decision was made in time for ESPN day 29" }),
          event("switch", DATES[2], { add: A, pickup_id: 5, pickup_status: "skipped" }),
          event("blocked", DATES[2], { add: A, reason: "unavailable", pickup_id: 5 }),
          event("switch", DATES[3], { add: B, pickup_id: 6, pickup_status: "pending" }),
        ],
        projection(3, [B, B, B, B])
      ),
      DAYS
    );
    expect(cells[1]).toMatchObject({ state: "missed", player: { name: "Holder" } });
    expect(cells[2]).toMatchObject({ state: "failed", player: { name: "Holder" }, note: "Alpha: he was no longer available" });
    expect(cells[3]).toMatchObject({ state: "scheduled", player: { name: "Bravo" }, switch: true });
    expect(cells[4]).toMatchObject({ state: "projected", player: { name: "Bravo" } });
  });

  test("a switch never scheduled (that player's pickup already was) is a day not made, not the projection", () => {
    const cells = laneCells(
      lane([event("blocked", DATES[2], { add: A, drop: HOLDER, reason: "already_scheduled" })], projection(2, [A, A, A])),
      DAYS
    );
    expect(cells[2]).toMatchObject({
      state: "failed",
      player: { name: "Holder" },
      switch: false,
      note: "Alpha: that player was already scheduled",
    });
    expect(cells[3]).toMatchObject({ state: "projected", player: { name: "Alpha" } });
  });
});

describe("laneStretches", () => {
  const sourceOf = (p: LanePlayer, from: number) => ({ id: p.player_id, name: p.name, from }) as unknown as SourcePlayer;

  test("each run of a free agent's days is a stretch replacing the holder", () => {
    const stretches = laneStretches(projection(1, [HOLDER, A, A, HOLDER, B, B]), HOLDER.player_id, DAYS, sourceOf);
    expect(stretches.map((x) => [x.player.name, x.from, x.until])).toEqual([
      ["Alpha", 2, 4],
      ["Bravo", 5, undefined],
    ]);
    expect(stretches.every((x) => x.replaces === HOLDER.player_id)).toBe(true);
  });

  test("days already played add nothing, a stretch ends with the projection, and no projection is nothing", () => {
    expect(laneStretches(projection(0, [A, A, B]), HOLDER.player_id, DAYS, sourceOf).map((x) => [x.player.name, x.from, x.until])).toEqual([
      ["Alpha", 1, 2],
      ["Bravo", 2, 3],
    ]);
    expect(laneStretches(null, HOLDER.player_id, DAYS, sourceOf)).toEqual([]);
  });

  test("a day the lane passed on keeps the spot's player, whatever the projection made before it said", () => {
    const stretches = (l: StreamLane) =>
      laneStretches(l.projection, HOLDER.player_id, DAYS, sourceOf, passedDates(laneCells(l, DAYS), DAYS)).map((x) => [
        x.player.name,
        x.from,
        x.until,
      ]);
    // Wednesday's pickup of Alpha failed: the projection still has him from Wednesday.
    const failed = lane(
      [
        event("switch", DATES[2], { add: A, drop: HOLDER, pickup_id: 5, pickup_status: "failed" }),
        event("blocked", DATES[2], { add: A, drop: HOLDER, reason: "espn_rejected", pickup_id: 5 }),
      ],
      projection(2, [A, A, A])
    );
    expect(stretches(failed)).toEqual([["Alpha", 3, 5]]);
    // Never scheduled (his pickup already was), or kept: the same.
    expect(stretches(lane([event("blocked", DATES[2], { add: A, reason: "already_scheduled" })], projection(2, [A, A, A])))).toEqual([
      ["Alpha", 3, 5],
    ]);
    expect(stretches(lane([event("keep", DATES[2])], projection(2, [A, A, A])))).toEqual([["Alpha", 3, 5]]);
    // A pickup still to be made previews from its day.
    expect(
      stretches(lane([event("switch", DATES[2], { add: A, pickup_id: 5, pickup_status: "pending" })], projection(2, [A, A, A])))
    ).toEqual([["Alpha", 2, 5]]);
  });

  test("a free agent the pool doesn't list plays the days he adds something", () => {
    const proj = projection(2, [A, A, B]);
    proj.days[1].value = 0;
    const src = projectedSource(A, proj, DAYS);
    expect(src.games.map((g) => (g ? 1 : 0))).toEqual([0, 0, 1, 0, 0, 0, 0]);
    expect(src.avg).toBe(20);
  });
});

describe("between reads", () => {
  const read = (open: StreamLane[], recent: StreamLane[] = []) => laneMarks({ open, recent });
  const started = event("started", DATES[1]);
  const first = read([lane([started], projection(2, [A, A, A]))]);

  test("a pickup a lane made between two reads changed the roster, though no read saw it pending", () => {
    // The run that decided Wednesday also made its pickup: the next read finds it done.
    const made = event("switch", DATES[2], { add: A, drop: HOLDER, pickup_id: 5, pickup_status: "executed" });
    const next = read([{ ...lane([started, made], projection(2, [A, A, A])), holder: A }]);
    expect(next.newest).toBeGreaterThan(first.newest);
    expect(laneMovedRoster(first, next)).toBe(true);
    expect(laneMovedRoster(next, next)).toBe(false);
  });

  test("a pickup seen pending changes the roster once made; pending or failed, it doesn't", () => {
    const at = (status: string) =>
      read([lane([started, { ...event("switch", DATES[2], { add: A, pickup_id: 6 }), id: 900, pickup_status: status }], null)]);
    expect(laneMovedRoster(first, at("pending"))).toBe(false);
    expect(laneMovedRoster(at("pending"), at("failed"))).toBe(false);
    expect(laneMovedRoster(at("pending"), at("executed"))).toBe(true);
  });

  test("a spot that changed hands, or a lane that ended with its last pickup made, changed the roster", () => {
    expect(laneMovedRoster(first, read([{ ...lane([started], null), holder: B }]))).toBe(true);
    const last = event("switch", DATES[6], { add: B, pickup_id: 7, pickup_status: "executed" });
    const ended = { ...lane([started, last, event("ended", null, { reason: "matchup_over" })], null), status: "ended" as const, holder: B };
    expect(laneMovedRoster(first, read([], [ended]))).toBe(true);
    // A lane that has only just started has done nothing yet.
    expect(laneMovedRoster(read([]), first)).toBe(false);
  });
});

describe("in words", () => {
  const label = (date: string) => DAYS.find((d) => d.date === date)?.dow ?? date;

  test("each event", () => {
    expect(eventLine(event("switch", DATES[2], { add: A, drop: HOLDER, pickup_status: "executed", reason: "projected_gone" }), label)).toBe(
      "Wed: picked up Alpha for Holder (the projected player was gone)"
    );
    expect(eventLine(event("switch", DATES[2], { add: A, pickup_status: "pending" }), label)).toBe("Wed: picking up Alpha");
    expect(eventLine(event("keep", DATES[3], { reason: "as_projected" }), label)).toBe("Thu: kept the spot as it was (as projected)");
    expect(eventLine(event("blocked", DATES[4], { reason: "missed" }), label)).toBe("Fri: couldn't act: no decision was made in time");
    expect(eventLine(event("paused", null, { reason: "holder_gone" }), label)).toBe("Paused: the spot's player left the roster");
    expect(eventLine(event("ended", null, { reason: "stopped" }), label)).toBe("Ended: you stopped it");
  });

  test("reasons", () => {
    expect(laneReason("can_write:not_team_owner")).toBe("ESPN won't take changes for this team right now");
    expect(laneReason("something_new")).toBe("something new");
    expect(laneReason(null)).toBeNull();
  });
});

describe("demoLanePlan", () => {
  test("switches while it pays and adds last, from the first open day", () => {
    const source = demoSource();
    const holder = source.mine.find((p) => p.name === "Keegan Murray")!;
    const plan = demoLanePlan(source, holder.id, DEMO_STREAMERS, 2, 2, (d) => 30 + d, new Date("2026-11-17T23:00:00Z"))!;
    expect(plan.start_period).toBe(32);
    expect(plan.projection.days).toHaveLength(source.days.length - 2);
    expect(plan.projection.adds).toBeLessThanOrEqual(2);
    expect(plan.projection.days.filter((d) => d.switch)).toHaveLength(plan.projection.adds);
    expect(plan.projection.gain).toBeCloseTo(plan.projection.value - plan.projection.hold_value);
    expect(plan.projection.gain).toBeGreaterThan(0);
  });
});
