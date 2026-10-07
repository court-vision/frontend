import { describe, expect, test } from "bun:test";
import { NO_TEAM, createFormStart, importFormStart, type TeamChoice } from "@/components/draft/model";

const HOME: TeamChoice = { id: 22, name: "Lvl. 3 Goblins", tag: "ESPN · PTS", espn: true };
const WORK: TeamChoice = { id: 40, name: "Office League", tag: "ESPN · CATS", espn: true };
const YAHOO: TeamChoice = { id: 31, name: "Paint Beasts", tag: "YAHOO · PTS", espn: false };

describe("createFormStart", () => {
  test("starts on the selected team; an ESPN league's room follows its ESPN draft", () => {
    expect(createFormStart([YAHOO, HOME], HOME.id)).toEqual({ teamId: HOME.id, kind: "live" });
    expect(createFormStart([YAHOO, HOME], YAHOO.id)).toEqual({ teamId: YAHOO.id, kind: "mock" });
  });

  test("no league, as a mock, when the selected team is not one of yours", () => {
    expect(createFormStart([YAHOO, HOME], 99)).toEqual({ teamId: NO_TEAM, kind: "mock" });
    expect(createFormStart([YAHOO, HOME], null)).toEqual({ teamId: NO_TEAM, kind: "mock" });
    expect(createFormStart([], null)).toEqual({ teamId: NO_TEAM, kind: "mock" });
  });
});

describe("importFormStart", () => {
  test("the selected team when it can be imported, else the first that can", () => {
    expect(importFormStart([HOME, WORK], WORK.id)).toBe(WORK.id);
    expect(importFormStart([HOME, WORK], YAHOO.id)).toBe(HOME.id);
    expect(importFormStart([HOME, WORK], null)).toBe(HOME.id);
    expect(importFormStart([], HOME.id)).toBeNull();
  });
});

describe("the lobby dialogs' reset", () => {
  // The dialogs reset when these values change. The lobby hands them a freshly
  // built team list on every render (a mutation settling, a refetch on focus),
  // so a rebuilt list holding the same teams must give the same plain values,
  // or the reset would wipe an error the dialog has just shown.
  test("a rebuilt list with the same teams starts both forms on the same values", () => {
    const teams = [YAHOO, HOME, WORK];
    const rebuilt = teams.map((t) => ({ ...t }));
    const before = createFormStart(teams, HOME.id);
    const after = createFormStart(rebuilt, HOME.id);
    expect(Object.is(before.teamId, after.teamId)).toBe(true);
    expect(Object.is(before.kind, after.kind)).toBe(true);
    const espn = (list: TeamChoice[]) => list.filter((t) => t.espn);
    expect(Object.is(importFormStart(espn(teams), WORK.id), importFormStart(espn(rebuilt), WORK.id))).toBe(true);
  });
});
