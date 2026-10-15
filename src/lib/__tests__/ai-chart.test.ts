import { describe, expect, test } from "bun:test";
import {
  barSpan,
  chartTable,
  formatValue,
  leaders,
  linePath,
  linePoints,
  niceScale,
  position,
  shortCategory,
  sourcesOf,
  spreadLabels,
  xTickIndexes,
} from "@/lib/ai-chart";
import type { AiChart } from "@/types/ai";

const CHART: AiChart = {
  type: "chart",
  id: "c1",
  title: "Blocks",
  kind: "line",
  result_ids: ["r2", "r3"],
  tools: ["get_game_log"],
  x: { key: "date", label: "Date" },
  categories: ["2026-10-19", "2026-10-21"],
  series: [
    { key: "A", label: "A", values: [1, 3] },
    { key: "C", label: "C", values: [null, 4] },
  ],
  total_rows: 2,
};

describe("words and values", () => {
  test("sources are named in words, unknown tools as they are", () => {
    expect(sourcesOf(["get_game_log", "get_matchup"])).toBe("box scores, your matchup");
    expect(sourcesOf(["get_new_thing"])).toBe("get_new_thing");
  });

  test("values keep integers, round the rest to two decimals and show a gap as a dash", () => {
    expect(formatValue(3)).toBe("3");
    expect(formatValue(2.456)).toBe("2.46");
    expect(formatValue(2.4)).toBe("2.4");
    expect(formatValue(null)).toBe("—");
    expect(formatValue(undefined)).toBe("—");
  });

  test("ISO dates shorten to month and day; names pass through", () => {
    expect(shortCategory("2026-10-21")).toBe("Oct 21");
    expect(shortCategory("2026-01-05")).toBe("Jan 5");
    expect(shortCategory("Walker Kessler")).toBe("Walker Kessler");
    expect(shortCategory("2026-13-01")).toBe("2026-13-01");
  });
});

describe("the value axis", () => {
  test("holds zero and every value with round ticks", () => {
    expect(niceScale([2.4, 1.8])).toEqual({ min: 0, max: 2.5, ticks: [0, 0.5, 1, 1.5, 2, 2.5] });
    expect(niceScale([3, 1, 4])).toEqual({ min: 0, max: 4, ticks: [0, 1, 2, 3, 4] });
    expect(niceScale([45, 120])).toEqual({ min: 0, max: 125, ticks: [0, 25, 50, 75, 100, 125] });
  });

  test("reaches below zero for negative values and ignores gaps", () => {
    expect(niceScale([-1.2, null, 3])).toEqual({ min: -2, max: 3, ticks: [-2, -1, 0, 1, 2, 3] });
    expect(niceScale([-0.4, -0.1])).toEqual({ min: -0.4, max: 0, ticks: [-0.4, -0.3, -0.2, -0.1, 0] });
  });

  test("tiny values keep their precision", () => {
    expect(niceScale([1e-6])).toEqual({ min: 0, max: 1e-6, ticks: [0, 2e-7, 4e-7, 6e-7, 8e-7, 1e-6] });
    expect(niceScale([0.003, 0.011])).toEqual({ min: 0, max: 0.012, ticks: [0, 0.002, 0.004, 0.006, 0.008, 0.01, 0.012] });
  });

  test("all zero or nothing at all gives 0..1", () => {
    expect(niceScale([0, 0])).toEqual({ min: 0, max: 1, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] });
    expect(niceScale([])).toEqual({ min: 0, max: 1, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] });
  });

  test("positions and bars run from zero either way", () => {
    const scale = niceScale([-1.2, 3]);
    expect(position(0, scale)).toBeCloseTo(0.4);
    expect(barSpan(3, scale)).toEqual({ start: 0.4, width: 0.6 });
    const left = barSpan(-1, scale);
    expect(left.start).toBeCloseTo(0.2);
    expect(left.width).toBeCloseTo(0.2);
  });
});

describe("lines", () => {
  const plot = { x: 40, y: 10, w: 400, h: 200 };

  test("points span the plot, with gaps kept as null and drawn as a broken path", () => {
    const scale = niceScale([1, 3, 4]);
    const points = linePoints([1, null, 4], scale, plot);
    expect(points[0]).toEqual({ x: 40, y: 160, i: 0 });
    expect(points[1]).toBeNull();
    expect(points[2]).toEqual({ x: 440, y: 10, i: 2 });
    expect(linePath(points)).toBe("M40 160M440 10");
    expect(linePath(linePoints([1, 3, 4], scale, plot))).toBe("M40 160L240 60L440 10");
  });

  test("a lone point sits in the middle", () => {
    expect(linePoints([2], niceScale([2]), plot)[0]?.x).toBe(240);
  });

  test("x labels are all of them when few, else every k-th from the first", () => {
    expect(xTickIndexes(4)).toEqual([0, 1, 2, 3]);
    expect(xTickIndexes(9)).toEqual([0, 2, 4, 6, 8]);
    expect(xTickIndexes(12)).toEqual([0, 3, 6, 9]);
    expect(xTickIndexes(30)).toEqual([0, 6, 12, 18, 24]);
    expect(xTickIndexes(7, 3)).toEqual([0, 3, 6]);
  });

  test("end labels are pushed apart in order and kept inside the plot", () => {
    expect(spreadLabels([100, 104, 200], 12, 0, 220)).toEqual([100, 112, 200]);
    expect(spreadLabels([215, 212], 12, 0, 220)).toEqual([220, 208]);
    expect(spreadLabels([50], 12, 0, 220)).toEqual([50]);
  });
});

describe("the chart's other readings", () => {
  test("each series peaks somewhere, or nowhere when it is all gaps", () => {
    expect(leaders(CHART.series)).toEqual([1, 1]);
    expect(leaders([{ key: "z", label: "z", values: [null, null] }])).toEqual([null]);
    expect(leaders([{ key: "t", label: "t", values: [2, 2, 1] }])).toEqual([0]);
  });

  test("the table twin has x first and a row per category", () => {
    expect(chartTable(CHART)).toEqual({
      columns: [
        { key: "date", label: "Date" },
        { key: "A", label: "A" },
        { key: "C", label: "C" },
      ],
      rows: [
        ["2026-10-19", 1, null],
        ["2026-10-21", 3, 4],
      ],
    });
  });
});
