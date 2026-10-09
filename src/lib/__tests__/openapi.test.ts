import { describe, expect, test } from "bun:test";
import {
  buildUrl,
  curlFor,
  fetchSnippet,
  fmtBytes,
  groupByTag,
  matchOps,
  paramDefaults,
  publicOps,
  pythonSnippet,
  rateLimitFor,
  sampleValue,
  schemaTree,
  scopeFor,
  typeLabel,
  type OpenApiDoc,
} from "@/lib/openapi";

const doc: OpenApiDoc = {
  info: { title: "Court Vision API", version: "1.0.0" },
  paths: {
    "/": { get: { summary: "Root" } },
    "/health": { get: { summary: "Health" } },
    "/v1/internal/teams/": { get: { tags: ["Teams"], summary: "hidden" } },
    "/v1/players/{player_id}/stats": {
      get: {
        tags: ["Players"],
        summary: "Get player statistics by ID",
        description: "Retrieve detailed statistics for a player by their ID.",
        parameters: [
          { name: "player_id", in: "path", required: true, schema: { type: "integer" }, description: "NBA player ID" },
          { name: "window", in: "query", required: false, schema: { type: "string", default: "season", pattern: "^(season|l[1-9][0-9]?)$" } },
        ],
        responses: { "200": { description: "ok", content: { "application/json": { schema: { $ref: "#/components/schemas/PlayerStatsResp" } } } }, "404": { description: "Player not found" } },
      },
    },
    "/v1/analytics/generate-lineup": {
      post: {
        tags: ["Analytics"],
        summary: "Generate optimized lineup",
        description: "Requires API key with 'analytics' scope.",
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/GenerateLineupRequest" } } } },
        responses: { "200": { description: "ok" } },
        security: [{ APIKeyHeader: [] }],
      },
    },
    "/v1/sqlmate/query": { post: { tags: ["SQLMate"], summary: "Run a visual query", responses: {} } },
  },
  components: {
    schemas: {
      PlayerStatsResp: {
        type: "object",
        properties: {
          status: { type: "string" },
          data: { anyOf: [{ $ref: "#/components/schemas/PlayerStats" }, { type: "null" }] },
        },
        required: ["status"],
      },
      PlayerStats: {
        type: "object",
        properties: {
          id: { type: "integer", description: "NBA player ID" },
          game_logs: { type: "array", items: { $ref: "#/components/schemas/GameLog" } },
          window: { type: "string", enum: ["season", "l5"] },
          self: { $ref: "#/components/schemas/PlayerStats" },
        },
        required: ["id"],
      },
      GameLog: { type: "object", properties: { date: { type: "string", format: "date" }, fpts: { type: "number" } } },
      GenerateLineupRequest: {
        type: "object",
        properties: {
          team_id: { type: "integer" },
          week: { type: "integer", minimum: 1, maximum: 26 },
          streaming_slots: { type: "integer", default: 2 },
          use_recent_stats: { type: "boolean", default: false },
        },
        required: ["team_id", "week"],
      },
    },
  },
};

describe("publicOps", () => {
  test("keeps the public routes, drops internal, root and ping, orders tags", () => {
    const ops = publicOps(doc);
    expect(ops.map((o) => o.id)).toEqual([
      "get:/v1/players/{player_id}/stats",
      "post:/v1/analytics/generate-lineup",
      "post:/v1/sqlmate/query",
      "get:/health",
    ]);
    expect(ops[3].tag).toBe("Meta");
  });

  test("reads auth, scope and the rate limit per route", () => {
    const ops = publicOps(doc);
    const stats = ops[0];
    expect(stats.auth).toBe("none");
    expect(stats.rateLimit).toBe("100 / min per IP");
    expect(stats.params.map((p) => [p.name, p.in, p.required])).toEqual([
      ["player_id", "path", true],
      ["window", "query", false],
    ]);
    const lineup = ops[1];
    expect(lineup.auth).toBe("api-key");
    expect(lineup.scope).toBe("analytics");
    expect(lineup.rateLimit).toBe("1,000 / min per key");
    expect(lineup.body?.$ref).toContain("GenerateLineupRequest");
    expect(ops[2].rateLimit).toBe("30 / min per IP");
    expect(rateLimitFor("/health", "none")).toBe("unlimited");
    expect(scopeFor("needs the \"read\" scope")).toBe("read");
    expect(scopeFor(null)).toBeNull();
  });

  test("groups by tag in order and matches by path, summary or tag", () => {
    const ops = publicOps(doc);
    expect(groupByTag(ops).map((g) => g.tag)).toEqual(["Players", "Analytics", "SQLMate", "Meta"]);
    expect(matchOps("stats", ops).map((o) => o.id)).toEqual(["get:/v1/players/{player_id}/stats"]);
    expect(matchOps("lineup", ops)[0].id).toBe("post:/v1/analytics/generate-lineup");
    expect(matchOps("sqlmate", ops)[0].tag).toBe("SQLMate");
    expect(matchOps("", ops).length).toBe(4);
  });
});

describe("schemas", () => {
  test("type labels name refs, arrays, enums, formats and nullability", () => {
    expect(typeLabel(doc, { $ref: "#/components/schemas/PlayerStats" })).toBe("PlayerStats");
    expect(typeLabel(doc, { anyOf: [{ $ref: "#/components/schemas/PlayerStats" }, { type: "null" }] })).toBe("PlayerStats | null");
    expect(typeLabel(doc, { type: "array", items: { $ref: "#/components/schemas/GameLog" } })).toBe("GameLog[]");
    expect(typeLabel(doc, { type: "string", enum: ["up", "down"] })).toBe('"up" | "down"');
    expect(typeLabel(doc, { type: "string", format: "date" })).toBe("string (date)");
    expect(typeLabel(doc, { type: ["number", "null"] })).toBe("number | null");
  });

  test("the tree walks refs, arrays and nullables, and stops at a cycle", () => {
    const tree = schemaTree(doc, { $ref: "#/components/schemas/PlayerStatsResp" });
    expect(tree.map((n) => [n.name, n.type, n.required])).toEqual([
      ["status", "string", true],
      ["data", "PlayerStats | null", false],
    ]);
    const data = tree[1];
    expect(data.ref).toBe("PlayerStats");
    const names = data.children.map((n) => n.name);
    expect(names).toEqual(["id", "game_logs", "window", "self"]);
    const logs = data.children[1];
    expect(logs.type).toBe("GameLog[]");
    expect(logs.children.map((n) => n.name)).toEqual(["date", "fpts"]);
    // PlayerStats inside PlayerStats: named, not expanded again
    expect(data.children[3].children).toEqual([]);
    expect(data.children[0].description).toBe("NBA player ID");
  });

  test("sample values honour defaults, requireds and formats", () => {
    expect(sampleValue(doc, { $ref: "#/components/schemas/GenerateLineupRequest" })).toEqual({
      team_id: 1,
      week: 1,
      streaming_slots: 2,
      use_recent_stats: false,
    });
    expect(sampleValue(doc, { type: "string", format: "date" })).toBe("2026-10-20");
    expect(sampleValue(doc, { type: "string", enum: ["rank", "adp"] })).toBe("rank");
  });
});

describe("requests", () => {
  const op = publicOps(doc)[0];

  test("defaults fill path ids and query defaults", () => {
    expect(paramDefaults(op, "2026-10-08")).toEqual({ player_id: "203999", window: "season" });
  });

  test("urls fill the path and skip blank query params", () => {
    expect(buildUrl("https://api.courtvision.dev", op, { player_id: "2544", window: "" })).toBe("https://api.courtvision.dev/v1/players/2544/stats");
    expect(buildUrl("https://api.courtvision.dev", op, { player_id: "2544", window: "l10" })).toBe("https://api.courtvision.dev/v1/players/2544/stats?window=l10");
    expect(buildUrl("x", op, { player_id: "a b" })).toBe("x/v1/players/a%20b/stats");
  });

  test("snippets carry the key and body only when they apply", () => {
    const url = "https://api.courtvision.dev/v1/players/2544/stats";
    const curl = curlFor(url, "GET", null, null);
    expect(curl).toContain("curl 'https://api.courtvision.dev/v1/players/2544/stats'");
    expect(curl).not.toContain("X-API-Key");
    const post = curlFor("u", "POST", "cv_abc", '{"team_id": 1}');
    expect(post).toContain("-X POST");
    expect(post).toContain("X-API-Key: cv_abc");
    expect(post).toContain(`-d '{"team_id": 1}'`);
    expect(fetchSnippet(url, "GET", null, null)).toContain('method: "GET"');
    expect(fetchSnippet("u", "POST", "k", "{}")).toContain("body: JSON.stringify({})");
    expect(pythonSnippet(url, "GET", "k", null)).toContain("requests.get(");
    expect(pythonSnippet("u", "POST", null, "{}")).toContain("requests.post(");
    expect(curlFor("it's", "GET", null, null)).toContain(`'it'\\''s'`);
  });

  test("bytes", () => {
    expect(fmtBytes(834)).toBe("834 B");
    expect(fmtBytes(1229)).toBe("1.2 KB");
  });
});
