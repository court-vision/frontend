/**
 * The developer desk's demo: a sample of the schema SQLMate exposes and
 * enough rows to answer a query in the browser, plus sample API keys. The
 * schema mirrors the real `nba.*` tables (backend/db/models/nba); the rows
 * are invented.
 */
import { NBA_TEAMS } from "@/lib/nbaTeams";
import type { ApiKeyListItem } from "@/types/api-keys";
import type { QueryRequest, QueryResponse, SchemaTable } from "@/types/sqlmate";

const col = (name: string, type: string) => ({ name, type });

export const DEMO_SCHEMA: SchemaTable[] = [
  { table: "nba.players", columns: [col("id", "INT"), col("espn_id", "INT"), col("name", "STR"), col("position", "STR"), col("created_at", "DATE"), col("updated_at", "DATE")] },
  { table: "nba.teams", columns: [col("id", "STR"), col("name", "STR"), col("conference", "STR"), col("division", "STR")] },
  {
    table: "nba.player_season_stats",
    columns: ["player_id:INT", "team_id:STR", "as_of_date:DATE", "season:STR", "gp:INT", "fpts:INT", "pts:INT", "reb:INT", "ast:INT", "stl:INT", "blk:INT", "tov:INT", "min:INT", "fgm:INT", "fga:INT", "fg3m:INT", "fg3a:INT", "ftm:INT", "fta:INT", "rost_pct:FLOAT"].map((s) => col(...(s.split(":") as [string, string]))),
  },
  {
    table: "nba.player_game_stats",
    columns: ["player_id:INT", "team_id:STR", "game_date:DATE", "game_id:STR", "fpts:INT", "pts:INT", "reb:INT", "ast:INT", "stl:INT", "blk:INT", "tov:INT", "min:INT", "fgm:INT", "fga:INT", "fg3m:INT", "fg3a:INT", "ftm:INT", "fta:INT"].map((s) => col(...(s.split(":") as [string, string]))),
  },
  { table: "nba.rankings", columns: ["id:INT", "curr_rank:INT", "name:STR", "team:STR", "fpts:INT", "avg_fpts:FLOAT", "rank_change:INT", "gp:INT", "as_of_date:DATE", "season:STR", "position:STR"].map((s) => col(...(s.split(":") as [string, string]))) },
  { table: "nba.team_stats", columns: ["team_id:STR", "as_of_date:DATE", "season:STR", "gp:INT", "w:INT", "l:INT", "w_pct:FLOAT", "pts:FLOAT", "reb:FLOAT", "ast:FLOAT", "off_rating:FLOAT", "def_rating:FLOAT", "net_rating:FLOAT", "pace:FLOAT"].map((s) => col(...(s.split(":") as [string, string]))) },
  { table: "nba.games", columns: ["game_id:STR", "game_date:DATE", "season:STR", "home_team_id:STR", "away_team_id:STR", "home_score:INT", "away_score:INT", "status:STR", "start_time_et:STR", "arena:STR"].map((s) => col(...(s.split(":") as [string, string]))) },
  { table: "nba.player_injuries", columns: ["player_id:INT", "report_date:DATE", "status:STR", "injury_type:STR", "injury_detail:STR", "expected_return:DATE"].map((s) => col(...(s.split(":") as [string, string]))) },
  { table: "nba.player_ownership", columns: ["player_id:INT", "snapshot_date:DATE", "rost_pct:FLOAT"].map((s) => col(...(s.split(":") as [string, string]))) },
];

type Row = Record<string, unknown>;

const PLAYERS: Array<[number, number, string, string, string]> = [
  [203999, 3112335, "Nikola Jokić", "C", "DEN"],
  [1629029, 3945274, "Luka Dončić", "G-F", "LAL"],
  [1628983, 4278073, "Shai Gilgeous-Alexander", "G", "OKC"],
  [1630178, 4431678, "Tyrese Maxey", "G", "PHI"],
  [1641705, 5104157, "Victor Wembanyama", "F-C", "SAS"],
  [1630567, 4433134, "Scottie Barnes", "F-G", "TOR"],
  [1627750, 3936299, "Jamal Murray", "G", "DEN"],
  [1630552, 4701230, "Jalen Johnson", "F", "ATL"],
  [201142, 3202, "Kevin Durant", "F", "HOU"],
  [1628378, 3908809, "Donovan Mitchell", "G", "CLE"],
  [1630595, 4432166, "Cade Cunningham", "G", "DET"],
  [1641708, 5105631, "Amen Thompson", "G-F", "HOU"],
];

const SEASON: Array<[number, number, number, number, number, number, number, number, number, number]> = [
  // gp, fpts/g, pts, reb, ast, stl, blk, tov, min, 3pm
  [65, 66.3, 27.7, 12.9, 10.7, 1.4, 0.8, 3.7, 34.4, 1.7],
  [64, 59.1, 28.4, 8.2, 8.6, 1.6, 0.5, 3.9, 35.1, 3.2],
  [68, 55.5, 31.1, 4.3, 6.6, 1.4, 0.7, 2.2, 32.7, 1.7],
  [70, 52.2, 27.9, 3.6, 6.5, 1.5, 0.4, 2.4, 36.2, 3.5],
  [64, 55.4, 25.0, 11.1, 3.9, 1.2, 3.8, 3.3, 33.1, 2.8],
  [80, 44.0, 19.1, 8.0, 5.9, 1.4, 1.3, 2.7, 34.0, 1.3],
  [75, 46.6, 21.4, 4.2, 6.3, 1.1, 0.3, 2.3, 32.6, 2.1],
  [72, 48.6, 20.3, 10.2, 5.5, 1.5, 0.9, 2.9, 34.5, 1.0],
  [78, 43.8, 25.9, 6.1, 4.2, 0.8, 1.1, 2.9, 35.0, 2.6],
  [70, 46.9, 24.8, 4.6, 4.9, 1.4, 0.3, 2.5, 32.4, 3.1],
  [64, 50.4, 25.6, 6.1, 9.2, 1.0, 0.8, 4.4, 35.3, 2.0],
  [79, 40.4, 15.4, 8.5, 4.0, 1.5, 1.3, 1.7, 31.9, 0.3],
];

function seasonRows(): Row[] {
  return PLAYERS.map(([id, , , , team], i) => {
    const s = SEASON[i];
    const r = (v: number) => Math.round(v * s[0]);
    return {
      player_id: id,
      team_id: team,
      as_of_date: "2026-04-12",
      season: "2025-26",
      gp: s[0],
      fpts: r(s[1]),
      pts: r(s[2]),
      reb: r(s[3]),
      ast: r(s[4]),
      stl: r(s[5]),
      blk: r(s[6]),
      tov: r(s[7]),
      min: r(s[8]),
      fgm: r(s[2] * 0.37),
      fga: r(s[2] * 0.75),
      fg3m: r(s[9]),
      fg3a: r(s[9] * 2.7),
      ftm: r(s[2] * 0.2),
      fta: r(s[2] * 0.24),
      rost_pct: 99.5 - i * 0.7,
    };
  });
}

function gameRows(): Row[] {
  const out: Row[] = [];
  const dates = ["2026-04-05", "2026-04-07", "2026-04-09", "2026-04-11"];
  PLAYERS.forEach(([id, , , , team], i) => {
    const s = SEASON[i];
    dates.forEach((d, j) => {
      const swing = ((i * 7 + j * 13) % 11) - 5;
      const pts = Math.max(4, Math.round(s[2] + swing));
      out.push({
        player_id: id,
        team_id: team,
        game_date: d,
        game_id: `00225${(1200 + i * 4 + j).toString().padStart(5, "0")}`,
        fpts: Math.round(s[1] + swing * 1.6),
        pts,
        reb: Math.round(s[3] + (swing % 3)),
        ast: Math.round(s[4] + (swing % 2)),
        stl: Math.max(0, Math.round(s[5] + (j % 2))),
        blk: Math.max(0, Math.round(s[6])),
        tov: Math.max(0, Math.round(s[7] + (j % 2) - 1)),
        min: Math.round(s[8]),
        fgm: Math.round(pts * 0.37),
        fga: Math.round(pts * 0.75),
        fg3m: Math.round(s[9]),
        fg3a: Math.round(s[9] * 2.7),
        ftm: Math.round(pts * 0.2),
        fta: Math.round(pts * 0.24),
      });
    });
  });
  return out;
}

export const DEMO_ROWS: Record<string, Row[]> = {
  "nba.players": PLAYERS.map(([id, espn, name, position]) => ({ id, espn_id: espn, name, position, created_at: "2025-10-01", updated_at: "2026-04-12" })),
  "nba.teams": NBA_TEAMS.map((t) => ({ id: t.abbrev, name: t.name, conference: t.conference, division: t.division })),
  "nba.player_season_stats": seasonRows(),
  "nba.player_game_stats": gameRows(),
  "nba.rankings": PLAYERS.map(([id, , name, position, team], i) => ({
    id,
    curr_rank: i + 1,
    name,
    team,
    fpts: Math.round(SEASON[i][1] * SEASON[i][0]),
    avg_fpts: SEASON[i][1],
    rank_change: [0, 0, 0, 0, 0, 2, -1, -1, 1, -1, 0, 4][i],
    gp: SEASON[i][0],
    as_of_date: "2026-04-12",
    season: "2025-26",
    position,
  })),
  "nba.team_stats": [
    ["OKC", 68, 14, 118.6, 109.5],
    ["CLE", 64, 18, 121.0, 111.8],
    ["BOS", 61, 21, 117.4, 109.8],
    ["DEN", 50, 32, 118.9, 115.1],
    ["NYK", 53, 29, 118.7, 112.3],
    ["HOU", 52, 30, 114.6, 110.4],
  ].map(([team, w, l, off, def]) => ({
    team_id: team,
    as_of_date: "2026-04-12",
    season: "2025-26",
    gp: (w as number) + (l as number),
    w,
    l,
    w_pct: Math.round(((w as number) / ((w as number) + (l as number))) * 1000) / 1000,
    pts: 116.5,
    reb: 45.6,
    ast: 27.4,
    off_rating: off,
    def_rating: def,
    net_rating: Math.round(((off as number) - (def as number)) * 10) / 10,
    pace: 98.7,
  })),
  "nba.games": [
    ["0022601234", "2026-10-20", "OKC", "HOU", 112, 104, "final", "19:30", "Paycom Center"],
    ["0022601235", "2026-10-20", "LAL", "GSW", 0, 0, "scheduled", "22:00", "Crypto.com Arena"],
    ["0022601236", "2026-10-21", "DEN", "MIN", 0, 0, "scheduled", "21:00", "Ball Arena"],
    ["0022601237", "2026-10-21", "BOS", "NYK", 0, 0, "scheduled", "19:30", "TD Garden"],
    ["0022601238", "2026-10-22", "PHI", "ATL", 0, 0, "scheduled", "19:00", "Xfinity Mobile Arena"],
    ["0022601239", "2026-10-22", "SAS", "DAL", 0, 0, "scheduled", "20:30", "Frost Bank Center"],
  ].map(([game_id, game_date, home, away, hs, as_, status, tip, arena]) => ({
    game_id,
    game_date,
    season: "2026-27",
    home_team_id: home,
    away_team_id: away,
    home_score: hs,
    away_score: as_,
    status,
    start_time_et: tip,
    arena,
  })),
  "nba.player_injuries": [
    { player_id: 1627750, report_date: "2026-10-06", status: "DAY_TO_DAY", injury_type: "Hamstring", injury_detail: "Strain", expected_return: "2026-10-22" },
    { player_id: 201142, report_date: "2026-10-07", status: "OUT", injury_type: "Rest", injury_detail: "Preseason", expected_return: "2026-10-20" },
    { player_id: 1630567, report_date: "2026-10-07", status: "QUESTIONABLE", injury_type: "Ankle", injury_detail: "Sprain", expected_return: null },
  ],
  "nba.player_ownership": PLAYERS.map(([id], i) => ({ player_id: id, snapshot_date: "2026-10-08", rost_pct: 99.5 - i * 0.7 })),
};

// ---------------------------------------------------------------------------
// A small evaluator: enough of SQLMate's semantics to answer the demo
// ---------------------------------------------------------------------------

function compare(a: unknown, op: string, b: string): boolean {
  if (a == null) return false;
  const text = typeof a === "string";
  const av = text ? (a as string).toLowerCase() : Number(a);
  const bv = text ? b.toLowerCase() : Number(b);
  switch (op) {
    case "=":
      return av === bv || String(a) === b;
    case "!=":
      return av !== bv && String(a) !== b;
    case "<":
      return av < bv;
    case "<=":
      return av <= bv;
    case ">":
      return av > bv;
    case ">=":
      return av >= bv;
    case "SUBSTRING":
      return String(av).includes(String(bv));
    case "PREFIX":
      return String(av).startsWith(String(bv));
    case "SUFFIX":
      return String(av).endsWith(String(bv));
    case "LIKE": {
      const re = new RegExp(`^${String(bv).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "i");
      return re.test(String(a));
    }
    default:
      return false;
  }
}

/** The column two tables share, the way SQLMate's foreign keys would join them. */
function joinKeys(a: string, b: string): [string, string] | null {
  const pairs: Array<[string, string, string, string]> = [
    ["nba.players", "id", "*", "player_id"],
    ["nba.teams", "id", "*", "team_id"],
    ["nba.teams", "id", "nba.games", "home_team_id"],
    ["nba.rankings", "id", "*", "player_id"],
    ["nba.players", "id", "nba.rankings", "id"],
  ];
  for (const [ta, ka, tb, kb] of pairs) {
    if (a === ta && (tb === "*" || tb === b)) return [ka, kb];
    if (b === ta && (tb === "*" || tb === a)) return [kb, ka];
  }
  return null;
}

function aggregate(type: string, values: unknown[]): unknown {
  const nums = values.filter((v) => typeof v === "number") as number[];
  switch (type) {
    case "COUNT":
      return values.filter((v) => v != null).length;
    case "SUM":
      return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
    case "AVG":
      return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : null;
    case "MIN":
      return nums.length ? Math.min(...nums) : null;
    case "MAX":
      return nums.length ? Math.max(...nums) : null;
    default:
      return null;
  }
}

/** Run a request against the demo rows. Mirrors the shape of SQLMate's answer, SQL text included. */
export function runDemoQuery(req: QueryRequest): QueryResponse {
  const parts = req.query_params;
  if (!parts.length) return { status: { status: "error", message: "No query parameters provided" } };
  for (const p of parts) if (!DEMO_ROWS[p.table]) return { status: { status: "error", message: `Table is not available: ${p.table}` } };

  // Filter each table, then join left to right on the shared key.
  let rows: Row[] = DEMO_ROWS[parts[0].table]
    .filter((r) => (parts[0].constraints ?? []).every((c) => compare(r[c.attribute], c.operator, c.value)))
    .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [`${parts[0].table}.${k}`, v])));
  for (const p of parts.slice(1)) {
    const right = DEMO_ROWS[p.table].filter((r) => (p.constraints ?? []).every((c) => compare(r[c.attribute], c.operator, c.value)));
    const keys = joinKeys(parts[0].table, p.table);
    const joined: Row[] = [];
    for (const l of rows) {
      for (const r of right) {
        if (!keys || l[`${parts[0].table}.${keys[0]}`] === r[keys[1]]) {
          joined.push({ ...l, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [`${p.table}.${k}`, v])) });
        }
      }
    }
    rows = joined;
  }

  // Columns in canvas order; aggregates collapse by the group-by columns.
  const selected = parts.flatMap((p) =>
    p.attributes.map((a) => ({
      key: `${p.table}.${a.attribute}`,
      label: a.alias || (parts.length > 1 ? `${p.table.split(".").pop()}_${a.attribute}` : a.attribute),
      agg: (p.aggregations ?? []).find((g) => g.attribute === a.attribute)?.type ?? null,
      group: (p.group_by ?? []).includes(a.attribute),
    }))
  );
  let out: Row[];
  if (selected.some((s) => s.agg)) {
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const gk = selected.filter((s) => s.group).map((s) => String(r[s.key])).join("\u0000");
      groups.set(gk, [...(groups.get(gk) ?? []), r]);
    }
    out = [...groups.values()].map((g) => Object.fromEntries(selected.map((s) => [s.key, s.agg ? aggregate(s.agg, g.map((r) => r[s.key])) : g[0][s.key]])));
  } else {
    out = rows;
  }

  for (const o of [...(req.options?.order_by ?? [])].reverse()) {
    const key = `${o.table_name}.${o.attribute}`;
    const dir = o.sort === "ASC" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const x = a[key] as number | string;
      const y = b[key] as number | string;
      return x === y ? 0 : x == null ? 1 : y == null ? -1 : x < y ? -dir : dir;
    });
  }
  const limit = Math.max(1, Math.min(10_000, req.options?.limit ?? 1000));
  out = out.slice(0, limit);

  const sql = [
    `SELECT ${selected.map((s) => (s.agg ? `${s.agg}(${s.key})` : s.key) + (s.label !== s.key.split(".").pop() ? ` AS ${s.label}` : "")).join(", ")}`,
    `FROM ${parts.map((p) => p.table).join(" JOIN ")}`,
    parts.some((p) => p.constraints?.length) ? `WHERE ${parts.flatMap((p) => (p.constraints ?? []).map((c) => `${p.table}.${c.attribute} ${c.operator} ${isNaN(Number(c.value)) ? `'${c.value}'` : c.value}`)).join(" AND ")}` : null,
    selected.some((s) => s.group) ? `GROUP BY ${selected.filter((s) => s.group).map((s) => s.key).join(", ")}` : null,
    req.options?.order_by?.length ? `ORDER BY ${req.options.order_by.map((o) => `${o.table_name}.${o.attribute} ${o.sort}`).join(", ")}` : null,
    `LIMIT ${limit}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    status: { status: "success", message: "Query executed successfully (demo)" },
    table: {
      query: sql,
      created_at: new Date().toISOString(),
      columns: selected.map((s) => s.label),
      rows: out.map((r) => selected.map((s) => r[s.key] ?? null)),
    },
  };
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export const DEMO_KEYS: ApiKeyListItem[] = [
  { id: "a1f7c2e0-0000-4000-8000-000000000001", name: "Notebook", key_prefix: "cv_8kQ2mN1x", scopes: ["read"], rate_limit: 1000, created_at: "2026-09-14T18:02:11Z", last_used_at: "2026-10-07T23:41:09Z", expires_at: null, is_active: true },
  { id: "a1f7c2e0-0000-4000-8000-000000000002", name: "Lineup bot", key_prefix: "cv_Zp04LwTa", scopes: ["read", "analytics"], rate_limit: 1000, created_at: "2026-10-01T09:30:00Z", last_used_at: null, expires_at: "2026-12-30T09:30:00Z", is_active: true },
];

export function demoRawKey(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let s = "cv_";
  for (let i = 0; i < 43; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
