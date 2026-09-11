import { describe, expect, test } from "bun:test";
import {
  DAILY_ACTIONS_ID,
  DASHBOARD_STORE_VERSION,
  insertDailyActions,
  migrateDashboardStore,
} from "../dashboard-migrations";
import type { DashboardLayouts } from "../../types/dashboard";

const item = (definitionId: string, x: number, y: number, h = 5) => ({ i: definitionId, definitionId, x, y, w: 4, h });

const LAYOUTS: DashboardLayouts = {
  default: { cols: 12, widgets: [item("today-leaders", 0, 0)] },
  "21": { cols: 12, widgets: [item("matchup-score", 0, 0), item("roster-overview", 5, 0, 7), item("daily-breakdown", 0, 5, 4)] },
  "22": { cols: 12, widgets: [] },
  "23": { cols: 12, widgets: [item(DAILY_ACTIONS_ID, 0, 0), item("matchup-score", 0, 5)] },
};

describe("insertDailyActions", () => {
  test("adds the widget at the top of a team layout and shifts the rest down by its height", () => {
    const out = insertDailyActions(LAYOUTS);
    const team = out["21"]!.widgets;
    expect(team[0]).toEqual({ i: "daily-actions-21", definitionId: DAILY_ACTIONS_ID, x: 0, y: 0, w: 5, h: 5, minW: 3, minH: 3 });
    expect(team.slice(1).map((w) => [w.definitionId, w.x, w.y])).toEqual([
      ["matchup-score", 0, 5],
      ["roster-overview", 5, 5],
      ["daily-breakdown", 0, 10],
    ]);
  });

  test("leaves the default, empty and already-migrated layouts alone", () => {
    const out = insertDailyActions(LAYOUTS);
    expect(out.default).toBe(LAYOUTS.default);
    expect(out["22"]).toBe(LAYOUTS["22"]);
    expect(out["23"]).toBe(LAYOUTS["23"]);
  });

  test("is idempotent and does not mutate its input", () => {
    const snapshot = JSON.parse(JSON.stringify(LAYOUTS));
    const once = insertDailyActions(LAYOUTS);
    expect(insertDailyActions(once)).toEqual(once);
    expect(LAYOUTS).toEqual(snapshot);
  });
});

describe("migrateDashboardStore", () => {
  test("v0 inserts; the current version passes through; garbage becomes an empty store", () => {
    expect(migrateDashboardStore({ layouts: LAYOUTS }, 0).layouts["21"]!.widgets[0]!.definitionId).toBe(DAILY_ACTIONS_ID);
    expect(migrateDashboardStore({ layouts: LAYOUTS }, DASHBOARD_STORE_VERSION).layouts).toBe(LAYOUTS);
    expect(migrateDashboardStore(undefined, 0)).toEqual({ layouts: {} });
  });
});
