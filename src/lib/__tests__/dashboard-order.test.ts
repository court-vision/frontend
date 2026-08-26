import { describe, expect, test } from "bun:test";
import { orderForMobile } from "../dashboard-order";
import {
  DEFAULT_LAYOUTS,
  MOBILE_ORDER,
} from "@/components/dashboard/core/defaultLayouts";
import type { LayoutTemplate } from "@/types/dashboard";

const item = (definitionId: string, x: number, y: number, i = definitionId) => ({
  i,
  definitionId,
  x,
  y,
});

describe("orderForMobile", () => {
  test("known widgets come first, in template order, regardless of grid position", () => {
    const widgets = [
      item("trending", 9, 0),
      item("schedule", 5, 0),
      item("today-leaders", 0, 0),
    ];
    const ordered = orderForMobile(widgets, ["today-leaders", "schedule", "trending"]);
    expect(ordered.map((w) => w.definitionId)).toEqual([
      "today-leaders",
      "schedule",
      "trending",
    ]);
  });

  test("unknown widgets follow, in grid reading order (y, then x)", () => {
    const widgets = [
      item("custom-b", 6, 5),
      item("custom-c", 0, 9),
      item("schedule", 5, 0),
      item("custom-a", 0, 5),
    ];
    const ordered = orderForMobile(widgets, ["schedule"]);
    expect(ordered.map((w) => w.definitionId)).toEqual([
      "schedule",
      "custom-a",
      "custom-b",
      "custom-c",
    ]);
  });

  test("duplicate definitions keep grid order among themselves", () => {
    const widgets = [
      item("watchlist", 4, 5, "w-low"),
      item("watchlist", 0, 0, "w-top"),
      item("schedule", 0, 5, "s"),
    ];
    const ordered = orderForMobile(widgets, ["watchlist", "schedule"]);
    expect(ordered.map((w) => w.i)).toEqual(["w-top", "w-low", "s"]);
  });

  test("an empty order falls back to grid reading order", () => {
    const widgets = [item("b", 3, 1), item("a", 0, 1), item("c", 0, 0)];
    expect(orderForMobile(widgets, []).map((w) => w.definitionId)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  test("does not mutate its input", () => {
    const widgets = [item("trending", 9, 0), item("schedule", 5, 0)];
    const snapshot = widgets.map((w) => ({ ...w }));
    orderForMobile(widgets, ["schedule", "trending"]);
    expect(widgets).toEqual(snapshot);
  });
});

describe("MOBILE_ORDER", () => {
  const templates = Object.keys(DEFAULT_LAYOUTS) as LayoutTemplate[];

  test("every template's order lists exactly its default widgets", () => {
    for (const template of templates) {
      const defaults = DEFAULT_LAYOUTS[template].widgets
        .map((w) => w.definitionId)
        .sort();
      expect([...MOBILE_ORDER[template]].sort()).toEqual(defaults);
    }
  });

  test("team template leads with the matchup score, categories with the category breakdown", () => {
    const first = (template: LayoutTemplate) =>
      orderForMobile(DEFAULT_LAYOUTS[template].widgets, MOBILE_ORDER[template])[0]
        ?.definitionId;
    expect(first("default")).toBe("today-leaders");
    expect(first("team")).toBe("matchup-score");
    expect(first("categories")).toBe("category-comparison");
  });
});
