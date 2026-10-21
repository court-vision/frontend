import { describe, expect, test } from "bun:test";
import {
  CHECKING,
  changeLabel,
  chipState,
  dropChipOf,
  patchChip,
  sendOrder,
  stageProblem,
  swapChipOf,
  timingOf,
  trayDaysOf,
  weekdayOf,
  withStaged,
  withoutStaged,
  type StagedChip,
} from "../ai-proposals";
import type { AiProposalChip } from "@/types/ai";

const NOW = Date.parse("2026-10-21T20:00:00Z");

function chip(over: Partial<AiProposalChip> = {}): AiProposalChip {
  return {
    proposal_id: 31,
    state: "proposed",
    kind: "transaction",
    team_id: 22,
    day: 2,
    date: "2026-10-21",
    dow: "Wed",
    scoring_period_id: 2,
    add: { espn_id: 6450, nba_player_id: 202695, name: "Kawhi Leonard", team: "LAC" },
    drop: { espn_id: 4594268, nba_player_id: 1630162, name: "Anthony Edwards", team: "MIN" },
    summary: "Add Kawhi Leonard, drop Anthony Edwards, today. Goes to ESPN when you send it.",
    reason: "4 games left at 2.4 blocks",
    change: 1.5,
    scoring: "points",
    expires_at: "2026-10-21T23:00:00Z",
    sent_at: null,
    ...over,
  };
}

const staged = (c: AiProposalChip, over: Partial<StagedChip> = {}): StagedChip => ({ chip: c, problems: [], error: null, checking: false, ...over });

describe("chipState", () => {
  test("a proposed chip past its expiry is expired; other states stand", () => {
    expect(chipState(chip(), NOW)).toBe("proposed");
    expect(chipState(chip(), Date.parse("2026-10-21T23:00:00Z"))).toBe("expired");
    expect(chipState(chip({ state: "sent" }), Date.parse("2026-10-30T00:00:00Z"))).toBe("sent");
    expect(chipState(chip({ state: "dismissed" }), NOW)).toBe("dismissed");
  });
});

describe("patchChip", () => {
  test("applies what the desk knows and leaves other chips alone", () => {
    const patches = new Map([[31, { state: "sent" as const, sent_at: "2026-10-21T20:05:00Z" }]]);
    expect(patchChip(chip(), patches)).toMatchObject({ state: "sent", sent_at: "2026-10-21T20:05:00Z", proposal_id: 31 });
    expect(patchChip(chip({ proposal_id: 32 }), patches).state).toBe("proposed");
  });
});

describe("stageProblem", () => {
  test("only a proposed chip of the tray's team can be staged", () => {
    expect(stageProblem(chip(), [], NOW)).toBeNull();
    expect(stageProblem(chip({ state: "sent" }), [], NOW)).toBe("This move was already sent.");
    expect(stageProblem(chip(), [], Date.parse("2026-10-22T00:00:00Z"))).toMatch(/expired/);
    expect(stageProblem(chip({ proposal_id: 32, team_id: 23 }), [staged(chip())], NOW)).toMatch(/one team's moves/);
    expect(stageProblem(chip({ proposal_id: 32 }), [staged(chip())], NOW)).toBeNull();
  });
});

const JOKIC = { espn_id: 3112335, nba_player_id: 203999, name: "Nikola Jokic", team: "DEN" };
const SOMEONE = { espn_id: 1, nba_player_id: null, name: "Someone", team: null };

describe("withStaged / withoutStaged", () => {
  test("stages a chip awaiting its check, replacing the day's other add and any chip moving the same player the same way", () => {
    const dropOnly = chip({ proposal_id: 30, add: null, drop: JOKIC });
    let list = withStaged([staged(dropOnly)], chip());
    expect(list.map((x) => x.chip.proposal_id)).toEqual([30, 31]);
    expect(list[1]).toMatchObject({ checking: true, problems: [], error: null });
    // Another add for the same day takes the column
    list = withStaged(list, chip({ proposal_id: 32, add: SOMEONE }));
    expect(list.map((x) => x.chip.proposal_id)).toEqual([30, 32]);
    // A lone drop of the player that add drops replaces it: he can only be dropped once
    list = withStaged(list, chip({ proposal_id: 34, add: null }));
    expect(list.map((x) => x.chip.proposal_id)).toEqual([30, 34]);
    // A later day's add is its own column, but adding the same player twice is one move
    list = withStaged(list, chip({ proposal_id: 33, day: 3, kind: "scheduled", date: "2026-10-22", dow: "Thu", drop: null }));
    expect(list.map((x) => x.chip.proposal_id)).toEqual([30, 34, 33]);
    list = withStaged(list, chip({ proposal_id: 35, day: 4, kind: "scheduled", date: "2026-10-23", dow: "Fri", drop: null }));
    expect(list.map((x) => x.chip.proposal_id)).toEqual([30, 34, 35]);
    // Adding him one day and dropping him a later one is a stream, kept
    list = withStaged(list, chip({ proposal_id: 36, day: 5, kind: "scheduled", date: "2026-10-24", dow: "Sat", add: SOMEONE, drop: chip().add }));
    expect(list.map((x) => x.chip.proposal_id)).toEqual([30, 34, 35, 36]);
    // Re-staging the same chip starts its check again
    list = withStaged(list.map((x) => ({ ...x, checking: false, error: "nope" })), chip({ proposal_id: 35, day: 4, drop: null }));
    expect(list.map((x) => x.chip.proposal_id)).toEqual([30, 34, 36, 35]);
    expect(list[3]).toMatchObject({ checking: true, error: null });
    expect(withoutStaged(list, 34).map((x) => x.chip.proposal_id)).toEqual([30, 36, 35]);
  });
});

describe("words", () => {
  test("weekday, timing and the change in the league's terms", () => {
    expect(weekdayOf("2026-10-22")).toBe("Thursday");
    expect(timingOf({ kind: "scheduled", date: "2026-10-22" })).toBe("Made for you before Thursday's games");
    expect(timingOf({ kind: "transaction", date: "2026-10-21" })).toBeNull();
    expect(changeLabel({ change: 4.5, scoring: "points" })).toBe("+4.5");
    expect(changeLabel({ change: -0.3, scoring: "points" })).toBe("−0.3");
    expect(changeLabel({ change: 1, scoring: "categories" })).toBe("+1 cat");
    expect(changeLabel({ change: -2, scoring: "categories" })).toBe("−2 cats");
    expect(changeLabel({ change: 0, scoring: "categories" })).toBe("0 cats");
    expect(changeLabel({ change: null, scoring: "points" })).toBeNull();
  });
});

describe("trayDaysOf", () => {
  test("one column per day: the add / drop as the swap, lone drops in drops, problems and errors carried", () => {
    const today = chip();
    const lone = chip({ proposal_id: 30, add: null, drop: JOKIC, change: -0.5 });
    const later = chip({ proposal_id: 33, day: 3, kind: "scheduled", date: "2026-10-22", dow: "Thu", scoring_period_id: 3, drop: null, change: null,
                         expires_at: "2026-10-23T04:00:00Z" });
    const days = trayDaysOf([staged(later, { checking: true }), staged(today, { problems: ["Kawhi Leonard is on waivers"] }), staged(lone, { error: "ESPN said no" })], NOW);

    expect(days.map((d) => d.day)).toEqual([2, 3]);
    const [wed, thu] = days;
    expect(wed).toMatchObject({ dow: "Wed", date: "10/21", moves: [], delta: 1.0, error: "ESPN said no" });
    expect(wed.swap).toEqual({
      add: { id: 6450, name: "Kawhi Leonard", team: "LAC", games: "LAC" },
      drop: { id: 4594268, name: "Anthony Edwards" },
      from: null,
      timings: [],
      timing: null,
    });
    expect(wed.drops).toEqual([{ id: 3112335, name: "Nikola Jokic" }]);
    expect(wed.problems).toEqual(["Kawhi Leonard is on waivers"]);
    expect(thu.swap).toMatchObject({ add: { id: 6450 }, drop: null, from: 3, timing: "Made for you before Thursday's games" });
    expect(thu.problems).toEqual([CHECKING]);
    expect(thu.delta).toBe(0);
  });

  test("a chip that stopped being proposed holds its column back", () => {
    const [col] = trayDaysOf([staged(chip())], Date.parse("2026-10-22T00:00:00Z"));
    expect(col.problems).toEqual(["This chip expired: the day it was for has started."]);
    expect(trayDaysOf([staged(chip({ state: "sent" }))], NOW)[0].problems).toEqual(["This move was already sent."]);
    expect(trayDaysOf([], NOW)).toEqual([]);
  });
});

describe("sendOrder and lookups", () => {
  test("a day's drops go first, then its add / drop; lookups find the swap and a lone drop", () => {
    const list = [staged(chip()), staged(chip({ proposal_id: 30, add: null })), staged(chip({ proposal_id: 33, day: 3 }))];
    expect(sendOrder(list, 2).map((x) => x.chip.proposal_id)).toEqual([30, 31]);
    expect(sendOrder(list, 3).map((x) => x.chip.proposal_id)).toEqual([33]);
    expect(sendOrder(list, 4)).toEqual([]);
    expect(swapChipOf(list, 2)?.chip.proposal_id).toBe(31);
    expect(swapChipOf(list, 5)).toBeUndefined();
    expect(dropChipOf(list, 4594268)?.chip.proposal_id).toBe(30);
    expect(dropChipOf(list, 6450)).toBeUndefined();
  });
});
