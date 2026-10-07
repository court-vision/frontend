import { describe, expect, test } from "bun:test";
import { buildWeekGrid } from "../week-grid";
import { DEMO_DAYS, DEMO_STREAMERS, DEMO_TODAY, demoBoard, demoSchedule, demoSource } from "../week-demo";
import { sourceFromStreamer } from "../week-source";
import { buildMatchupDay, dayBars, statOf, weekBars, EMPTY_LINE } from "../matchup-day";

const source = demoSource();
const board = demoBoard();
const grid = buildWeekGrid({ source, board, staged: {}, incoming: null, viewDay: DEMO_TODAY });
const days = source.days.map((d) => buildMatchupDay(source, grid, d.index));

describe("buildMatchupDay", () => {
  const today = days[DEMO_TODAY];

  test("seats the opponent spot for spot against your lineup", () => {
    const active = today.rows.filter((r) => r.group === "active");
    expect(active).toHaveLength(10);
    expect(active.map((r) => r.slot)).toEqual(["PG", "SG", "SF", "PF", "C", "G", "F", "UT", "UT", "UT"]);
    expect(active.find((r) => r.slot === "PG")?.opp?.name).toBe("Jalen Brunson");
    expect(active.find((r) => r.slot === "C")?.opp?.name).toBe("Bam Adebayo");
    expect(today.rows.filter((r) => r.group === "bench").map((r) => r.opp?.name)).toEqual([
      "Tyler Herro",
      "Kel'el Ware",
      "Lauri Markkanen",
    ]);
  });

  test("only active spots with a game count, and bench points stay out of the totals", () => {
    const herro = today.rows.find((r) => r.opp?.name === "Tyler Herro")!.opp!;
    expect(herro.counts).toBe(false);
    expect(herro.fpts).toBe(31.5);
    // Live and final starters: Edwards, Adebayo, Banchero, Holmgren, Wembanyama.
    expect(today.opp).toMatchObject({ live: 4, done: 1 });
    expect(today.opp.actual).toBe(176.5);
    expect(today.opp.line.pts).toBeGreaterThan(0);
  });

  test("the spot's edge goes to the higher counted score", () => {
    const sf = today.rows.find((r) => r.slot === "SF")!;
    // Barnes is final at 44.0 against Banchero's 44.0 live: level, no edge.
    expect(sf.you?.fpts).toBe(44);
    expect(sf.edge).toBeNull();
    const c = today.rows.find((r) => r.slot === "C")!;
    expect(c.edge).toBe("you"); // Jokić 41.5 live vs Adebayo 39.0 final
  });

  test("days ahead project, days past reuse today's spots", () => {
    const thu = days[3];
    expect(thu.kind).toBe("future");
    expect(thu.spotsAsToday).toEqual({ you: false, opp: true });
    const withGame = thu.rows.find((r) => r.you?.game && r.you.counts)!;
    expect(withGame.you!.projected).toBe(true);
    expect(days[0].spotsAsToday.you).toBe(true);
    expect(days[0].you.actual).toBe(grid.you[0].actual);
  });

  test("a previewed free agent is marked on your side of his spot", () => {
    const fa = DEMO_STREAMERS.find((s) => s.name === "Dyson Daniels")!;
    const murray = board.players.find((p) => p.name === "Keegan Murray")!;
    const player = sourceFromStreamer(fa, DEMO_DAYS, demoSchedule(fa.team), DEMO_TODAY + 1);
    const preview = buildWeekGrid({ source, board, staged: {}, incoming: { player, replaces: murray.player_id }, viewDay: DEMO_TODAY });
    const wed = buildMatchupDay(source, preview, DEMO_TODAY + 1);
    const marked = wed.rows.filter((r) => r.you?.incoming);
    expect(marked.map((r) => r.you?.name)).toEqual(["Dyson Daniels"]);
    expect(marked[0].group).toBe("active");
    expect(wed.rows.every((r) => !r.opp?.incoming)).toBe(true);
    expect(days[DEMO_TODAY + 1].rows.some((r) => r.you?.incoming)).toBe(false);
  });
});

describe("bars", () => {
  test("a points day leads with fantasy points, then the counted stats", () => {
    const bars = dayBars(days[DEMO_TODAY], source);
    expect(bars[0]).toMatchObject({ key: "fpts", headline: true });
    expect(bars.map((b) => b.key)).toContain("fg_pct");
    const to = bars.find((b) => b.key === "tov")!;
    expect(to.lowerIsBetter).toBe(true);
    expect(to.leader).toBe(to.you < to.opp ? "you" : to.you > to.opp ? "opp" : null);
  });

  test("a future day projects fantasy points and has no box score yet", () => {
    const bars = dayBars(days[4], source);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ key: "fpts", projected: true });
  });

  test("the week's points bar is the official score", () => {
    const bars = weekBars(days, source, grid);
    expect(bars[0].you).toBe(source.you.current!);
    expect(bars[0].opp).toBe(source.opp.current!);
  });

  test("category leagues read the API's week and skip fantasy points", () => {
    const cats = {
      ...source,
      format: "categories" as const,
      categories: [
        { key: "pts", label: "PTS", higherIsBetter: true, isRate: false },
        { key: "tov", label: "TO", higherIsBetter: false, isRate: false },
      ],
      weekCategories: [{ key: "pts", you: 300, opp: 280 }],
    };
    const week = weekBars(days, cats, grid);
    expect(week.map((b) => b.key)).toEqual(["pts", "tov"]);
    expect(week[0]).toMatchObject({ you: 300, opp: 280, leader: "you" });
    expect(dayBars(days[DEMO_TODAY], cats).some((b) => b.key === "fpts")).toBe(false);
  });

  test("percentages come from makes over attempts", () => {
    expect(statOf({ ...EMPTY_LINE, fgm: 5, fga: 10 }, "fg_pct")).toBe(0.5);
    expect(statOf(EMPTY_LINE, "ft_pct")).toBe(0);
    expect(statOf(EMPTY_LINE, "dd")).toBeNull();
  });
});
