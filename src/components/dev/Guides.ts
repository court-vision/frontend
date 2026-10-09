/**
 * The short guides at the top of the reference: what a caller needs that
 * the operation list cannot say. Markdown-ish: `##` headings, paragraphs,
 * `-` bullets, backtick code, fenced blocks.
 */
export interface Guide {
  id: string;
  title: string;
  summary: string;
  body: string;
}

export const GUIDES: Guide[] = [
  {
    id: "quickstart",
    title: "Quickstart",
    summary: "One request, no key.",
    body: `Everything under \`/v1\` that is not \`/v1/internal\` is public. No account, no key: call it.

\`\`\`bash
curl 'https://api.courtvision.dev/v1/rankings/?window=14' -H 'Accept: application/json'
\`\`\`

Every answer is the same envelope: \`status\`, \`message\`, \`data\`. On a success \`data\` holds the result; on an empty result (before opening night, say) \`data\` is \`null\` and \`message\` says why.

## Where the numbers come from
The data platform fills the \`nba.*\` tables from nba_api, ESPN and Yahoo on a schedule: box scores after games, rankings and ownership daily, live lines every minute while games run. The API reads those tables; nothing is computed on the request except the player windows and the lineup optimiser.

## Two player ids
NBA ids (\`nba.players.id\`, what nba_api uses) are the canonical ones: every \`/v1/players/{player_id}/...\` route takes them. ESPN ids appear on fantasy payloads; \`GET /v1/players/stats?espn_id=\` translates. \`GET /v1/players/search\` finds a player by name or either id.`,
  },
  {
    id: "auth",
    title: "Keys & scopes",
    summary: "When you need a key, and what it unlocks.",
    body: `Public routes need no key. A key is for the **Analytics** routes, which act on your connected teams: send it as \`X-API-Key\`.

\`\`\`bash
curl 'https://api.courtvision.dev/v1/analytics/breakout-streamers?limit=10' \\
  -H 'X-API-Key: cv_...'
\`\`\`

- Keys start with \`cv_\`. The full key is shown once, when it is created; only its prefix is kept.
- Scopes: \`read\` (the default) and \`analytics\`. The Analytics routes need \`analytics\`; a key without it gets a 403 \`API_KEY_SCOPE\`.
- A key can expire on a day you choose, and can be revoked at any time. A revoked or expired key gets a 401 \`INVALID_API_KEY\`.
- Keyed routes run at 1,000 requests a minute per key, counted across every replica.

Keys are made on this desk, signed in. Anything about *your* fantasy teams in the app itself (lineups, pickups, drafts) goes through the signed-in session, not a key.`,
  },
  {
    id: "envelope",
    title: "Envelope & errors",
    summary: "What every response looks like, and how failures are named.",
    body: `\`\`\`json
{
  "status": "success",
  "message": "Player stats retrieved successfully",
  "data": { ... }
}
\`\`\`

- \`status\` is \`success\`, \`error\`, \`not_found\`, \`rate_limited\`, \`server_error\` or \`unauthorized\`; the HTTP status agrees with it.
- Failures carry \`error_code\` (\`RATE_LIMITED\`, \`AUTH_REQUIRED\`, \`INVALID_API_KEY\`, \`API_KEY_SCOPE\`, \`SQLMATE_UNAVAILABLE\`, ...) and a \`correlation_id\` in \`data\`.
- Send your own \`X-Correlation-ID\` header and the backend logs it; mention it when something looks wrong and the request can be found.
- A 404 means the thing does not exist (no such player, no games that day). An empty result that is expected, such as rankings before opening night, is a 200 with \`data: null\` and a \`message\`.
- Rates and percentages: player averages come as 0–100 (\`avg_fg_pct: 48.7\`); the rankings' per-category values, projections and team stats come as 0–1 fractions. Dates are \`YYYY-MM-DD\` in Eastern time, the NBA's game day.`,
  },
  {
    id: "limits",
    title: "Rate limits",
    summary: "100 a minute by address, 1,000 by key, 30 for queries.",
    body: `- Public routes: **100 requests a minute** per IP address.
- Analytics routes with a key: **1,000 a minute** per key.
- \`POST /v1/sqlmate/query\`: **30 a minute** per IP; the schema read counts as public.
- Over the limit: HTTP 429, \`status: rate_limited\`, \`error_code: RATE_LIMITED\`, and a \`Retry-After\` header in seconds.

Be gentle with the player routes: a player's full picture is several calls (stats, percentiles, status, ownership, profile, trends, projection). Cache what does not change within the hour, and fetch game logs once per window rather than per stat.`,
  },
  {
    id: "sqlmate",
    title: "SQLMate",
    summary: "The query builder's contract, for calling it yourself.",
    body: `The query builder is SQLMate, a visual SQL service behind the API: you name tables, columns, filters and ordering, it writes the SQL, resolves the joins along foreign keys, runs it read-only against the analytics schemas, and returns a table.

\`\`\`json
{
  "query_params": [
    {
      "table": "nba.players",
      "attributes": [{ "attribute": "name", "alias": "" }],
      "constraints": [{ "attribute": "position", "operator": "SUBSTRING", "value": "G" }],
      "group_by": [],
      "aggregations": []
    },
    {
      "table": "nba.player_season_stats",
      "attributes": [{ "attribute": "fpts", "alias": "total_fpts" }],
      "constraints": [{ "attribute": "gp", "operator": ">=", "value": "60" }]
    }
  ],
  "options": { "limit": 100, "order_by": [{ "table_name": "nba.player_season_stats", "attribute": "fpts", "sort": "DESC" }] }
}
\`\`\`

- \`GET /v1/sqlmate/schema\` lists every table you can name, with column types (\`INT\`, \`FLOAT\`, \`STR\`, \`DATE\`, \`BOOL\`).
- Operators: \`=\`, \`!=\`, \`<\`, \`<=\`, \`>\`, \`>=\`, \`LIKE\`, and \`SUBSTRING\`, \`PREFIX\`, \`SUFFIX\`, which become \`LIKE\` with the wildcards placed for you. Text columns are quoted and escaped; numeric columns take numbers only.
- Aggregates: \`SUM\`, \`COUNT\`, \`AVG\`, \`MIN\`, \`MAX\`, with \`group_by\` on the other columns.
- \`limit\` defaults to 1,000 and caps at 10,000. Order by as many columns as you like, first wins.
- The answer: \`status\`, and a \`table\` with \`query\` (the SQL it ran), \`columns\` and \`rows\` (arrays, in column order). With one table the column names are bare; with several they are prefixed by the table.
- Signed in, a result can be saved as a table of your own (\`u_<you>_<name>\`), queried again like any other, and deleted.

The service connects as a least-privilege database role with SELECT on the analytics schemas only, and rejects any generated statement that is not a read.`,
  },
];
