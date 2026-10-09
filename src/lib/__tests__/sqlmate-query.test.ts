import { describe, expect, test } from "bun:test";
import {
  EMPTY_CANVAS,
  addConstraint,
  addOrder,
  addTable,
  cellText,
  describe as describeCanvas,
  groupSchema,
  matchTables,
  moveOrder,
  removeTable,
  setAggregate,
  setAlias,
  setLimit,
  toRequest,
  toggleColumn,
  toggleGroupBy,
  updateConstraint,
  validate,
  valuePlaceholder,
} from "@/lib/sqlmate-query";
import { DEMO_SCHEMA, runDemoQuery } from "@/lib/dev-demo";

const players = DEMO_SCHEMA[0];
const season = DEMO_SCHEMA[2];

describe("canvas", () => {
  test("tables are added once and removed with their filters and ordering", () => {
    let c = addTable(addTable(EMPTY_CANVAS, players), players);
    expect(c.tables.length).toBe(1);
    c = addConstraint(c, "nba.players", "position");
    c = addOrder(c, "nba.players", "name");
    c = removeTable(c, "nba.players");
    expect(c.tables).toEqual([]);
    expect(c.constraints).toEqual([]);
    expect(c.order).toEqual([]);
  });

  test("validation says what is missing, in order", () => {
    let c = EMPTY_CANVAS;
    expect(validate(c)).toBe("Add a table from the schema.");
    c = addTable(c, players);
    expect(validate(c)).toBe("Pick at least one column.");
    c = toggleColumn(c, "nba.players", "name");
    expect(validate(c)).toBeNull();
    c = addConstraint(c, "nba.players", "position");
    expect(validate(c)).toContain("Give the filter");
    c = updateConstraint(c, c.constraints[0].id, { value: "C" });
    expect(validate(c)).toBeNull();
    c = toggleColumn(c, "nba.players", "id");
    c = setAggregate(c, "nba.players", "id", "COUNT");
    expect(validate(c)).toContain("needs Group: players.name");
    c = toggleGroupBy(c, "nba.players", "name");
    expect(validate(c)).toBeNull();
  });

  test("the request carries selected columns, filters per table, group by, aggregates and ordering", () => {
    let c = addTable(addTable(EMPTY_CANVAS, players), season);
    c = toggleColumn(c, "nba.players", "name");
    c = setAlias(c, "nba.players", "name", "player name");
    c = toggleColumn(c, "nba.player_season_stats", "fpts");
    c = addConstraint(c, "nba.player_season_stats", "gp", ">=");
    c = updateConstraint(c, c.constraints[0].id, { value: "60" });
    c = addOrder(c, "nba.player_season_stats", "fpts");
    c = setLimit(c, 25);
    expect(toRequest(c)).toEqual({
      query_params: [
        { table: "nba.players", attributes: [{ attribute: "name", alias: "player_name" }], constraints: [], group_by: [], aggregations: [] },
        { table: "nba.player_season_stats", attributes: [{ attribute: "fpts", alias: "" }], constraints: [{ attribute: "gp", operator: ">=", value: "60" }], group_by: [], aggregations: [] },
      ],
      options: { limit: 25, order_by: [{ table_name: "nba.player_season_stats", attribute: "fpts", sort: "DESC" }] },
    });
    expect(describeCanvas(c)).toBe("players × player_season_stats · 2 columns · 1 filter · by fpts desc · top 25");
  });

  test("limits clamp to the server's ceiling; ordering can be reprioritised", () => {
    expect(setLimit(EMPTY_CANVAS, 50_000).limit).toBe(10_000);
    expect(setLimit(EMPTY_CANVAS, 0).limit).toBe(1);
    expect(setLimit(EMPTY_CANVAS, NaN).limit).toBe(100);
    let c = addTable(EMPTY_CANVAS, players);
    c = addOrder(c, "nba.players", "name");
    c = addOrder(c, "nba.players", "id");
    const [a, b] = c.order.map((o) => o.id);
    c = moveOrder(c, b, -1);
    expect(c.order.map((o) => o.id)).toEqual([b, a]);
    expect(moveOrder(c, b, -1).order.map((o) => o.id)).toEqual([b, a]);
  });

  test("helpers", () => {
    expect(groupSchema(DEMO_SCHEMA).map((g) => g.schema)).toEqual(["nba"]);
    expect(matchTables("inj", DEMO_SCHEMA).map((t) => t.table)).toEqual(["nba.player_injuries"]);
    expect(matchTables("rost_pct", DEMO_SCHEMA).length).toBe(2);
    expect(valuePlaceholder("STR", "PREFIX")).toBe("text");
    expect(valuePlaceholder("INT", ">=")).toBe("0");
    expect(valuePlaceholder("DATE", "=")).toBe("2026-10-20");
    expect(cellText(null)).toBe("—");
    expect(cellText(12.3456)).toBe("12.35");
    expect(cellText("2026-10-20T00:00:00")).toBe("2026-10-20");
  });
});

describe("demo evaluator", () => {
  test("filters, orders and limits a single table", () => {
    const res = runDemoQuery({
      query_params: [{ table: "nba.players", attributes: [{ attribute: "name", alias: "" }, { attribute: "position", alias: "" }], constraints: [{ attribute: "position", operator: "SUBSTRING", value: "G" }] }],
      options: { limit: 3, order_by: [{ table_name: "nba.players", attribute: "name", sort: "ASC" }] },
    });
    expect(res.status.status).toBe("success");
    expect(res.table?.columns).toEqual(["name", "position"]);
    expect(res.table?.rows.length).toBe(3);
    expect(res.table?.rows[0][0]).toBe("Amen Thompson");
    expect(res.table?.query).toContain("WHERE nba.players.position SUBSTRING 'G'");
  });

  test("joins players to their season line and aggregates by team", () => {
    const res = runDemoQuery({
      query_params: [
        { table: "nba.players", attributes: [{ attribute: "name", alias: "" }], constraints: [] },
        { table: "nba.player_season_stats", attributes: [{ attribute: "fpts", alias: "" }], constraints: [{ attribute: "gp", operator: ">=", value: "70" }] },
      ],
      options: { limit: 100, order_by: [{ table_name: "nba.player_season_stats", attribute: "fpts", sort: "DESC" }] },
    });
    expect(res.table?.columns).toEqual(["players_name", "player_season_stats_fpts"]);
    // seven players with 70+ games; Maxey's 52.2 × 70 is the biggest season total among them
    expect(res.table?.rows.length).toBe(7);
    expect(res.table?.rows[0][0]).toBe("Tyrese Maxey");

    const agg = runDemoQuery({
      query_params: [
        { table: "nba.player_season_stats", attributes: [{ attribute: "team_id", alias: "" }, { attribute: "fpts", alias: "total" }], constraints: [], group_by: ["team_id"], aggregations: [{ attribute: "fpts", type: "SUM" }] },
      ],
      options: { limit: 100, order_by: [{ table_name: "nba.player_season_stats", attribute: "fpts", sort: "DESC" }] },
    });
    expect(agg.table?.columns).toEqual(["team_id", "total"]);
    const den = agg.table?.rows.find((r) => r[0] === "DEN");
    expect(den?.[1]).toBe(Math.round(66.3 * 65) + Math.round(46.6 * 75));
    expect(agg.table?.rows[0][0]).toBe("DEN");
  });

  test("an unknown table is refused like the service refuses it", () => {
    expect(runDemoQuery({ query_params: [{ table: "usr.teams", attributes: [] }] }).status.status).toBe("error");
    expect(runDemoQuery({ query_params: [] }).status.status).toBe("error");
  });
});
