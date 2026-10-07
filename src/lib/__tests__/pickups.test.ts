import { describe, expect, test } from "bun:test";
import { pickupNote, pickupTiming, pickupViews } from "../pickups";
import { DEMO_DAYS, DEMO_STREAMERS, DEMO_TODAY, demoScheduledPickup, demoSource } from "../week-demo";
import type { ScheduledPickup } from "@/types/scheduled-pickup";

const camara = DEMO_STREAMERS.find((s) => s.name === "Toumani Camara")!;
const daniels = DEMO_STREAMERS.find((s) => s.name === "Dyson Daniels")!;
const pending = demoScheduledPickup(1, camara, null, 5);
const settled = (over: Partial<ScheduledPickup>): ScheduledPickup => ({ ...demoScheduledPickup(9, daniels, null, 4), ...over });

describe("pickupViews", () => {
  test("pending first, then those settled for a day of this week; cancelled ones left out", () => {
    const views = pickupViews(
      {
        pending: [pending],
        recent: [
          settled({ id: 2, status: "executed", seated_slot: "PG" }),
          settled({ id: 3, status: "cancelled" }),
          settled({ id: 4, status: "skipped", reason: "unavailable", nba_date: "2026-11-02" }),
        ],
      },
      DEMO_DAYS
    );
    expect(views.map((v) => [v.id, v.status, v.day])).toEqual([
      [1, "pending", 5],
      [2, "executed", 4],
    ]);
    expect(views[1].note).toBe("Added, starting at PG");
  });

  test("a pending pickup for another week keeps its date and no day", () => {
    const later = { ...pending, id: 7, nba_date: "2026-11-17" };
    expect(pickupViews({ pending: [later], recent: [] }, DEMO_DAYS)[0]).toMatchObject({ day: null, date: "2026-11-17" });
  });
});

describe("pickupNote", () => {
  test("says why a pickup waits, or how it settled", () => {
    expect(pickupNote({ status: "pending", reason: null, seated_slot: null, detail: null })).toBeNull();
    expect(pickupNote({ status: "pending", reason: "add_on_waivers", seated_slot: null, detail: null })).toBe("Waiting: he's on waivers");
    expect(pickupNote({ status: "executed", reason: null, seated_slot: null, detail: null })).toBe("Added, on the bench");
    expect(pickupNote({ status: "skipped", reason: "unavailable", seated_slot: null, detail: null })).toBe("Skipped: he was no longer available");
    expect(pickupNote({ status: "failed", reason: "espn_rejected", seated_slot: null, detail: "Roster limit" })).toBe("Failed: Roster limit");
    expect(pickupNote({ status: "expired", reason: "some_new_reason", seated_slot: null, detail: null })).toBe("Expired: some new reason");
  });
});

describe("pickupTiming", () => {
  const source = demoSource();
  const mine = (name: string) => source.mine.find((p) => p.name === name)!;

  test("waits for the night into the day when the player dropped plays the day before", () => {
    // Barnes plays Fri (day 4): a Saturday pickup waits for the rollover.
    expect(pickupTiming(DEMO_DAYS, 5, mine("Scottie Barnes"), DEMO_TODAY, null)).toBe(
      "Made overnight into Sat, after Barnes plays Fri"
    );
  });

  test("otherwise goes at the day before's first tip-off", () => {
    // Murray has no game Fri (day 4).
    expect(pickupTiming(DEMO_DAYS, 5, mine("Keegan Murray"), DEMO_TODAY, null)).toBe("Made at Fri's first tip-off");
    expect(pickupTiming(DEMO_DAYS, 5, null, DEMO_TODAY, null)).toBe("Made at Fri's first tip-off");
  });

  test("goes right away for tomorrow once today's games have started", () => {
    expect(pickupTiming(DEMO_DAYS, DEMO_TODAY + 1, null, DEMO_TODAY, DEMO_TODAY + 1)).toBe(
      "Made right away: today's games have started"
    );
  });
});
