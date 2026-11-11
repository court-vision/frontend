import { describe, expect, test } from "bun:test";
import { applyLabel, daySpan, doneLabel, holdDays, holdLine, holdTag, holdsCanChange, holdsOn, isSteering, shortDay, steerHow } from "../steering";
import type { AiHoldChange, AiLaneAction, AiProposalChip, AiSteerAction } from "@/types/ai";
import type { TeamHold } from "@/types/team-hold";

const EDWARDS = { espn_id: 4594268, nba_player_id: 1630162, name: "Anthony Edwards", team: "MIN" };

function hold(over: Partial<AiHoldChange> = {}): AiHoldChange {
  return { kind: "keep", player: EDWARDS, share: null, starts_on: "2026-11-06", ends_on: "2026-11-08", effect: "Keep", ...over };
}

function teamHold(over: Partial<TeamHold> = {}): TeamHold {
  return {
    hold_id: 5,
    kind: "override",
    player: EDWARDS,
    share: 0,
    starts_on: "2026-11-06",
    ends_on: "2026-11-07",
    reason: "Hamstring, out through Saturday",
    effect: "Count Anthony Edwards out",
    applied_by: "user",
    proposal_id: 41,
    created_at: "2026-11-05T20:00:00Z",
    ...over,
  };
}

type ChipBits = Pick<AiProposalChip, "kind" | "lane" | "steer">;
const lane = (op: AiLaneAction["op"]): ChipBits => ({
  kind: "lane",
  steer: null,
  lane: {
    op,
    lane_id: op === "start" ? null : 3,
    holder: EDWARDS,
    status: null,
    end_date: "2026-11-08",
    gain: null,
    adds: null,
    value: null,
    hold_value: null,
    adds_left: null,
    first_decision_at: null,
    days: [],
  },
});
const steer = (action: AiSteerAction): ChipBits => ({ kind: "steer", lane: null, steer: action });

describe("steering chips", () => {
  test("which chips steer an automation rather than go in the tray", () => {
    expect(isSteering({ kind: "steer" })).toBe(true);
    expect(isSteering({ kind: "lane" })).toBe(true);
    expect(isSteering({ kind: "cancel_pickup" })).toBe(true);
    expect(isSteering({ kind: "transaction" })).toBe(false);
    expect(isSteering({ kind: "lineup" })).toBe(false);
  });

  test("days, by the date alone", () => {
    expect(shortDay("2026-11-06")).toBe("Fri 11/6");
    expect(daySpan("2026-11-06", "2026-11-06")).toBe("Fri 11/6");
    expect(daySpan("2026-11-06", "2026-11-08")).toBe("Fri 11/6 to Sun 11/8");
  });

  test("a hold's tag and line", () => {
    expect(holdTag("keep", null)).toBe("KEEP");
    expect(holdTag("override", 0)).toBe("OUT");
    expect(holdTag("override", 0.5)).toBe("50%");
    expect(holdLine(hold())).toBe("Keep Anthony Edwards · Fri 11/6 to Sun 11/8");
    expect(holdLine(hold({ kind: "override", share: 0 }))).toBe("Count out Anthony Edwards · Fri 11/6 to Sun 11/8");
    expect(holdLine(hold({ kind: "override", share: 1.25, ends_on: "2026-11-06" }))).toBe("Count at 125% Anthony Edwards · Fri 11/6");
    expect(holdLine(hold({ kind: "block" }))).toBe("Don't add Anthony Edwards · Fri 11/6 to Sun 11/8");
  });

  test("the apply button says what applying does", () => {
    expect(applyLabel(steer({ holds: [hold()], clear: [] }))).toBe("Set the hold");
    expect(applyLabel(steer({ holds: [hold(), hold({ kind: "pin" })], clear: [] }))).toBe("Apply the holds");
    const cleared = { ...hold(), hold_id: 5, reason: "r" };
    expect(applyLabel(steer({ holds: [], clear: [cleared] }))).toBe("Clear the hold");
    expect(applyLabel(steer({ holds: [], clear: [cleared, { ...cleared, hold_id: 6 }] }))).toBe("Clear the holds");
    expect(applyLabel(steer({ holds: [hold()], clear: [cleared] }))).toBe("Apply the holds");
    expect(applyLabel(lane("start"))).toBe("Start the lane");
    expect(applyLabel(lane("pause"))).toBe("Pause the lane");
    expect(applyLabel(lane("resume"))).toBe("Resume the lane");
    expect(applyLabel(lane("stop"))).toBe("Stop the lane");
    expect(applyLabel({ kind: "cancel_pickup", lane: null, steer: null })).toBe("Cancel the pickup");
    expect(steerHow({ kind: "steer" })).toContain("auto-lineup and the lanes");
    expect(doneLabel({ kind: "steer" })).toBe("Applied");
    expect(doneLabel({ kind: "transaction" })).toBe("Sent");
  });
});

describe("holds in the Week desk", () => {
  const WEEK = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];

  test("the days of the week a hold covers", () => {
    expect(holdDays(teamHold(), WEEK)).toEqual([4, 5]);
    expect(holdDays(teamHold({ starts_on: "2026-11-08", ends_on: "2026-11-12" }), WEEK)).toEqual([6]);
    expect(holdDays(teamHold({ starts_on: "2026-11-10", ends_on: "2026-11-12" }), WEEK)).toEqual([]);
  });

  test("the holds in force on a day", () => {
    const holds = [teamHold(), teamHold({ hold_id: 6, kind: "pin", share: null, starts_on: "2026-11-07", ends_on: "2026-11-07" })];
    expect(holdsOn(holds, "2026-11-06").map((h) => h.hold_id)).toEqual([5]);
    expect(holdsOn(holds, "2026-11-07").map((h) => h.hold_id)).toEqual([5, 6]);
    expect(holdsOn(holds, "2026-11-08")).toEqual([]);
  });

  test("the list is read again while Dime can add to it or a hold is on it", () => {
    expect(holdsCanChange(undefined)).toBe(false);
    // An account off the AI desk with no holds: nothing can change it, so it isn't polled
    expect(holdsCanChange({ enabled: false, holds: [] })).toBe(false);
    expect(holdsCanChange({ enabled: true, holds: [] })).toBe(true);
    // A hold left on a team whose account left the AI desk still steers, and can be cleared elsewhere
    expect(holdsCanChange({ enabled: false, holds: [teamHold()] })).toBe(true);
  });
});
