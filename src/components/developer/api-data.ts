import { API_BASE as BACKEND_API_BASE } from "@/endpoints";

// ─── Shared Types ────────────────────────────────────────

export interface Param {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface CodeExample {
  curl: string;
  python: string;
  typescript: string;
}

export interface Endpoint {
  method: "GET" | "POST";
  path: string;
  description: string;
  params: Param[];
  code: CodeExample;
  response: string;
}

export interface EndpointCategory {
  id: string;
  label: string;
  endpoints: Endpoint[];
}

// ─── Constants ───────────────────────────────────────────

export const API_BASE = `${BACKEND_API_BASE}/v1`;

// ─── Endpoint Data ───────────────────────────────────────

export const categories: EndpointCategory[] = [
  {
    id: "players",
    label: "Players",
    endpoints: [
      {
        method: "GET",
        path: "/players/",
        description: "List NBA players with optional filters for name, team, position, and games played.",
        params: [
          { name: "name", type: "string", required: false, description: "Search by player name (partial match)" },
          { name: "team", type: "string", required: false, description: "Filter by team abbreviation (e.g. LAL)" },
          { name: "position", type: "string", required: false, description: "Filter by position (G, F, C)" },
          { name: "min_games", type: "integer", required: false, description: "Minimum games played" },
          { name: "limit", type: "integer", required: false, description: "Results per page (1–100, default 50)" },
          { name: "offset", type: "integer", required: false, description: "Pagination offset (default 0)" },
        ],
        code: {
          curl: `curl -H "X-API-Key: cv_your_key" \\
  "${API_BASE}/players/?team=LAL"`,
          python: `import requests

headers = {"X-API-Key": "cv_your_key"}
r = requests.get("${API_BASE}/players/",
                 params={"team": "LAL"},
                 headers=headers)
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/players/?team=LAL', {
  headers: { 'X-API-Key': 'cv_your_key' }
})
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "message": "Players retrieved",
  "data": {
    "players": [
      {
        "id": 2544,
        "espn_id": 1966,
        "name": "LeBron James",
        "team": "LAL",
        "position": "SF",
        "games_played": 52,
        "avg_fpts": 48.2,
        "rank": 4
      }
    ],
    "total": 312,
    "limit": 50,
    "offset": 0
  }
}`,
      },
      {
        method: "GET",
        path: "/players/stats",
        description: "Get detailed statistics for a player. Use espn_id or player_id for reliable lookups, or name + team for public queries. Use window to get averages over a specific game window.",
        params: [
          { name: "espn_id", type: "integer", required: false, description: "ESPN player ID (preferred for internal lookups)" },
          { name: "player_id", type: "integer", required: false, description: "Player ID (alias for espn_id)" },
          { name: "name", type: "string", required: false, description: "Player name (used with team for public queries)" },
          { name: "team", type: "string", required: false, description: "Team abbreviation (used with name)" },
          { name: "window", type: "string", required: false, description: "Stat window: 'season' (default) or 'lN' for last N games (e.g. l5, l10)" },
        ],
        code: {
          curl: `curl -H "X-API-Key: cv_your_key" \\
  "${API_BASE}/players/stats?name=LeBron+James"`,
          python: `import requests

headers = {"X-API-Key": "cv_your_key"}
r = requests.get("${API_BASE}/players/stats",
                 params={"name": "LeBron James"},
                 headers=headers)
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/players/stats?name=LeBron+James', {
  headers: { 'X-API-Key': 'cv_your_key' }
})
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": {
    "id": 2544,
    "name": "LeBron James",
    "team": "LAL",
    "games_played": 52,
    "window": "season",
    "window_games": 52,
    "avg_stats": {
      "avg_fpts": 48.2,
      "avg_points": 23.8,
      "avg_rebounds": 7.6,
      "avg_assists": 8.9,
      "avg_steals": 1.2,
      "avg_blocks": 0.6,
      "avg_turnovers": 3.4,
      "avg_minutes": 35.1,
      "avg_fg_pct": 0.521,
      "avg_fg3_pct": 0.408,
      "avg_ft_pct": 0.752
    },
    "advanced_stats": {
      "off_rating": 118.4,
      "def_rating": 112.1,
      "net_rating": 6.3,
      "usg_pct": 0.298,
      "ast_pct": 0.412,
      "pie": 0.182
    },
    "game_logs": [
      {
        "date": "2026-02-28",
        "fpts": 54,
        "pts": 28,
        "reb": 9,
        "ast": 11,
        "stl": 2,
        "blk": 1,
        "tov": 3,
        "min": 36,
        "fgm": 11,
        "fga": 19,
        "fg3m": 2,
        "fg3a": 5,
        "ftm": 4,
        "fta": 5
      }
    ]
  }
}`,
      },
      {
        method: "GET",
        path: "/players/{id}/games",
        description: "Get game-by-game log for a player showing full box scores.",
        params: [
          { name: "id", type: "integer", required: true, description: "Player ID (path parameter)" },
          { name: "limit", type: "integer", required: false, description: "Number of games to return (1–50, default 10)" },
        ],
        code: {
          curl: `curl -H "X-API-Key: cv_your_key" \\
  "${API_BASE}/players/2544/games?limit=10"`,
          python: `import requests

headers = {"X-API-Key": "cv_your_key"}
r = requests.get("${API_BASE}/players/2544/games",
                 params={"limit": 10},
                 headers=headers)`,
          typescript: `const res = await fetch('${API_BASE}/players/2544/games?limit=10', {
  headers: { 'X-API-Key': 'cv_your_key' }
})`,
        },
        response: `{
  "status": "success",
  "data": {
    "player_id": 2544,
    "player_name": "LeBron James",
    "team": "LAL",
    "games": [
      {
        "date": "2026-02-28",
        "opponent": "BOS",
        "home": true,
        "fpts": 54,
        "pts": 28,
        "reb": 9,
        "ast": 11,
        "stl": 2,
        "blk": 1,
        "tov": 3,
        "min": 36,
        "fgm": 11,
        "fga": 19,
        "fg3m": 2,
        "fg3a": 5,
        "ftm": 4,
        "fta": 5
      }
    ],
    "total_games": 1
  }
}`,
      },
      {
        method: "GET",
        path: "/players/{id}/trends",
        description: "Get rolling average trends for a player over fixed periods (last 7, 14, and 30 days) and ownership changes.",
        params: [
          { name: "id", type: "integer", required: true, description: "Player ID (path parameter)" },
        ],
        code: {
          curl: `curl -H "X-API-Key: cv_your_key" \\
  "${API_BASE}/players/2544/trends"`,
          python: `import requests

headers = {"X-API-Key": "cv_your_key"}
r = requests.get("${API_BASE}/players/2544/trends",
                 headers=headers)`,
          typescript: `const res = await fetch('${API_BASE}/players/2544/trends', {
  headers: { 'X-API-Key': 'cv_your_key' }
})`,
        },
        response: `{
  "status": "success",
  "data": {
    "player_id": 2544,
    "player_name": "LeBron James",
    "team": "LAL",
    "current_rank": 4,
    "trends": {
      "last_7_days": { "avg_fpts": 51.0, "games": 4 },
      "last_14_days": { "avg_fpts": 49.3, "games": 7 },
      "last_30_days": { "avg_fpts": 47.8, "games": 14 }
    },
    "ownership": {
      "current": 99.1,
      "change_7d": 0.2
    }
  }
}`,
      },
      {
        method: "GET",
        path: "/players/{id}/percentiles",
        description: "Get a player's statistical percentile ranks compared to all qualifying players. All values are integers 0–100.",
        params: [
          { name: "id", type: "integer", required: true, description: "Player ID (path parameter)" },
          { name: "min_games", type: "integer", required: false, description: "Minimum games played to qualify (default 20)" },
        ],
        code: {
          curl: `curl -H "X-API-Key: cv_your_key" \\
  "${API_BASE}/players/2544/percentiles?min_games=20"`,
          python: `import requests

headers = {"X-API-Key": "cv_your_key"}
r = requests.get("${API_BASE}/players/2544/percentiles",
                 params={"min_games": 20},
                 headers=headers)`,
          typescript: `const res = await fetch('${API_BASE}/players/2544/percentiles?min_games=20', {
  headers: { 'X-API-Key': 'cv_your_key' }
})`,
        },
        response: `{
  "status": "success",
  "data": {
    "avg_fpts": 96,
    "avg_points": 94,
    "avg_rebounds": 82,
    "avg_assists": 97,
    "avg_steals": 55,
    "avg_blocks": 44,
    "avg_turnovers": 18,
    "avg_minutes": 91,
    "avg_fg_pct": 78,
    "avg_fg3_pct": 63,
    "avg_ft_pct": 52
  }
}`,
      },
    ],
  },
  {
    id: "rankings",
    label: "Rankings",
    endpoints: [
      {
        method: "GET",
        path: "/rankings/",
        description: "Get fantasy basketball player rankings by fantasy points (default) or by summed per-category z-scores for H2H category leagues. Use window for rolling averages over the last 7, 14, or 30 days. Omit for full-season rankings.",
        params: [
          { name: "window", type: "integer", required: false, description: "Rolling day window: 7, 14, or 30 (anything else is a 422). Omit for full-season rankings." },
          { name: "format", type: "string", required: false, description: "`points` (default) or `categories` (sum of category z-scores; rates are z-scored on impact = (pct − pool pct) × attempts)." },
          { name: "categories", type: "string", required: false, description: "Comma-separated category keys for format=categories; defaults to standard 9-cat (fg_pct, ft_pct, fg3m, pts, reb, ast, stl, blk, tov). Allowed: pts, reb, ast, stl, blk, tov, fgm, fga, fg_pct, ftm, fta, ft_pct, fg3m, fg3a, fg3_pct." },
          { name: "min_games", type: "integer", required: false, description: "Optional games-played floor for format=categories (1–82); no floor by default, so the new season ranks from day 1." },
        ],
        code: {
          curl: `curl "${API_BASE}/rankings/?window=14&format=categories"`,
          python: `import requests

r = requests.get("${API_BASE}/rankings/",
                 params={"window": 14, "format": "categories"})
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/rankings/?window=14&format=categories')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": [
    {
      "id": 1641705,
      "rank": 1,
      "player_name": "Victor Wembanyama",
      "team": "SAS",
      "total_fpts": 345.0,
      "avg_fpts": 69.0,
      "rank_change": 0,
      "gp": 5,
      "categories": {"fg_pct": 0.5612, "ft_pct": 0.8837, "fg3m": 1.6, "pts": 31.2,
                     "reb": 14.4, "ast": 4.2, "stl": 0.8, "blk": 3.0, "tov": 1.6},
      "category_z": {"fg_pct": 1.42, "ft_pct": 0.61, "fg3m": 0.33, "pts": 3.1,
                     "reb": 3.4, "ast": 0.4, "stl": -0.1, "blk": 5.2, "tov": 0.5},
      "score": 17.843
    }
  ],
  "meta": {
    "format": "categories",
    "window": 14,
    "as_of": "2026-11-03",
    "season": "2026-27",
    "season_day": 15,
    "max_gp": 7,
    "categories": [{"key": "fg_pct", "label": "FG%", "higher_is_better": true, "is_rate": true}, "..."],
    "pool_size": 319,
    "min_games": 1,
    "scoring": {"basis": "categories", "point_weights": null, "league_id": null,
                "league_name": null, "settings_synced": null, "unsupported": []}
  }
}`,
      },
    ],
  },
  {
    id: "games",
    label: "Games",
    endpoints: [
      {
        method: "GET",
        path: "/games/{date}",
        description: "Get all NBA games for a specific date. Returns live scores and status for today's games.",
        params: [
          { name: "date", type: "string", required: true, description: "Date in YYYY-MM-DD format (path parameter). Must be a specific date — 'today' is not supported." },
        ],
        code: {
          curl: `curl "${API_BASE}/games/2026-02-28"`,
          python: `import requests

r = requests.get("${API_BASE}/games/2026-02-28")
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/games/2026-02-28')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": {
    "date": "2026-02-28",
    "games": [
      {
        "game_id": "0022500789",
        "game_date": "2026-02-28",
        "home_team": "LAL",
        "away_team": "BOS",
        "home_score": 104,
        "away_score": 98,
        "status": "in_progress",
        "arena": "Crypto.com Arena",
        "period": 3,
        "game_clock": "PT04M32.00S",
        "start_time_et": "20:00"
      }
    ],
    "count": 1
  }
}`,
      },
    ],
  },
  {
    id: "schedule",
    label: "Schedule",
    endpoints: [
      {
        method: "GET",
        path: "/schedule/weeks",
        description: "Get all fantasy week dates for the active season, the current week number, and the season calendar (key, dates, phase).",
        params: [],
        code: {
          curl: `curl "${API_BASE}/schedule/weeks"`,
          python: `import requests

r = requests.get("${API_BASE}/schedule/weeks")
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/schedule/weeks')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "message": "Schedule weeks retrieved successfully",
  "data": {
    "weeks": [
      { "week": 1, "start_date": "2026-10-20", "end_date": "2026-10-25", "game_span": 6 },
      { "week": 2, "start_date": "2026-10-26", "end_date": "2026-11-01", "game_span": 7 },
      { "week": 24, "start_date": "2027-04-05", "end_date": "2027-04-11", "game_span": 7 }
    ],
    "current_week": 2,
    "season": {
      "key": "2026-27",
      "label": "2026–27",
      "espn_year": 2027,
      "preseason_start": "2026-10-03",
      "regular_season_start": "2026-10-20",
      "regular_season_end": "2027-04-11",
      "phase": "regular",
      "season_day": 8,
      "week_count": 24
    }
  }
}`,
      },
    ],
  },
  {
    id: "teams",
    label: "Teams",
    endpoints: [
      {
        method: "GET",
        path: "/teams/{abbrev}/schedule",
        description: "Get the schedule for an NBA team including upcoming and past games.",
        params: [
          { name: "abbrev", type: "string", required: true, description: "Team abbreviation (path parameter, e.g. LAL, BOS, GSW)" },
          { name: "upcoming", type: "boolean", required: false, description: "Only return future games (default false)" },
          { name: "limit", type: "integer", required: false, description: "Maximum games to return (1–100, default 20)" },
        ],
        code: {
          curl: `curl "${API_BASE}/teams/LAL/schedule?upcoming=true"`,
          python: `import requests

r = requests.get("${API_BASE}/teams/LAL/schedule",
                 params={"upcoming": True})
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/teams/LAL/schedule?upcoming=true')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": {
    "team": "LAL",
    "team_name": "Los Angeles Lakers",
    "schedule": [
      {
        "date": "2026-02-28",
        "opponent": "BOS",
        "home": false,
        "back_to_back": false,
        "status": "scheduled",
        "team_score": null,
        "opponent_score": null
      }
    ],
    "remaining_games": 24,
    "total_games": 1
  }
}`,
      },
    ],
  },
  {
    id: "ownership",
    label: "Ownership",
    endpoints: [
      {
        method: "GET",
        path: "/ownership/trending",
        description: "Get players with significant ownership changes. Uses velocity-based ranking by default, which surfaces emerging players better than absolute change alone.",
        params: [
          { name: "days", type: "integer", required: false, description: "Lookback period in days (1–30, default 7)" },
          { name: "min_change", type: "number", required: false, description: "Minimum ownership change in percentage points (default 5.0)" },
          { name: "min_ownership", type: "number", required: false, description: "Minimum ownership % to filter noise (default 3.0)" },
          { name: "sort_by", type: "string", required: false, description: "'velocity' (relative change, default) or 'change' (absolute)" },
          { name: "direction", type: "string", required: false, description: "'up', 'down', or 'both' (default 'both')" },
          { name: "limit", type: "integer", required: false, description: "Maximum players per direction (1–50, default 20)" },
        ],
        code: {
          curl: `curl "${API_BASE}/ownership/trending?days=7&direction=up"`,
          python: `import requests

r = requests.get("${API_BASE}/ownership/trending",
                 params={"days": 7, "direction": "up"})
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/ownership/trending?days=7&direction=up')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": {
    "days": 7,
    "min_ownership": 3.0,
    "sort_by": "velocity",
    "trending_up": [
      {
        "player_id": 1641705,
        "player_name": "Jalen Williams",
        "team": "OKC",
        "current_ownership": 89.2,
        "previous_ownership": 76.8,
        "change": 12.4,
        "velocity": 16.1
      }
    ],
    "trending_down": [
      {
        "player_id": 1629057,
        "player_name": "Trae Young",
        "team": "ATL",
        "current_ownership": 81.3,
        "previous_ownership": 88.9,
        "change": -7.6,
        "velocity": -8.6
      }
    ]
  }
}`,
      },
    ],
  },
  {
    id: "live",
    label: "Live",
    endpoints: [
      {
        method: "GET",
        path: "/live/players/today",
        description: "Get live player stats for all games in progress today. Updated every ~60 seconds during game time. Note: will require 'live' scope in a future update.",
        params: [],
        code: {
          curl: `curl "${API_BASE}/live/players/today"`,
          python: `import requests

r = requests.get("${API_BASE}/live/players/today")
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/live/players/today')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": {
    "game_date": "2026-02-28",
    "player_count": 52,
    "players": [
      {
        "espn_id": 1966,
        "player_id": 2544,
        "player_name": "LeBron James",
        "game_id": "0022500789",
        "game_date": "2026-02-28",
        "game_status": 2,
        "period": 3,
        "game_clock": "PT04M32.00S",
        "fpts": 32,
        "pts": 18,
        "reb": 5,
        "ast": 7,
        "stl": 1,
        "blk": 0,
        "tov": 2,
        "min": 24,
        "fgm": 7,
        "fga": 14,
        "fg3m": 1,
        "fg3a": 3,
        "ftm": 3,
        "fta": 4,
        "last_updated": "2026-02-28T22:17:04+00:00"
      }
    ]
  }
}`,
      },
      {
        method: "GET",
        path: "/live/scoreboard",
        description: "Get the current NBA scoreboard with live game statuses. Reflects near-real-time state from NBA's live CDN. Does not include team names or scores — use GET /games/{date} for full game details. Note: will require 'live' scope in a future update.",
        params: [],
        code: {
          curl: `curl "${API_BASE}/live/scoreboard"`,
          python: `import requests

r = requests.get("${API_BASE}/live/scoreboard")
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/live/scoreboard')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": {
    "game_date": "2026-02-28",
    "game_count": 7,
    "games": [
      {
        "game_id": "0022500789",
        "game_status": 2,
        "game_status_label": "in_progress",
        "period": 3,
        "game_clock": "PT04M32.00S"
      },
      {
        "game_id": "0022500790",
        "game_status": 1,
        "game_status_label": "scheduled",
        "period": null,
        "game_clock": null
      }
    ]
  }
}`,
      },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    endpoints: [
      {
        method: "POST",
        path: "/analytics/generate-lineup",
        description: "Auto-fetch your roster and free agents from your connected ESPN or Yahoo team and generate an optimized lineup. No manual player data needed — just your team ID. Requires an API key with 'analytics' scope and a team added via the manage-teams page.",
        params: [
          { name: "team_id", type: "integer", required: true, description: "Your team ID (visible on the manage-teams page)" },
          { name: "week", type: "integer", required: true, description: "Matchup week to optimize for (1–24)" },
          { name: "streaming_slots", type: "integer", required: false, description: "Number of streaming add/drop moves to consider (default 2, max 10)" },
          { name: "use_recent_stats", type: "boolean", required: false, description: "Weight recent performance over season averages (default false)" },
        ],
        code: {
          curl: `curl -X POST -H "X-API-Key: cv_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"team_id": 42, "week": 18, "streaming_slots": 2}' \\
  "${API_BASE}/analytics/generate-lineup"`,
          python: `import requests

headers = {
    "X-API-Key": "cv_your_key",
    "Content-Type": "application/json"
}
payload = {
    "team_id": 42,
    "week": 18,
    "streaming_slots": 2,
    "use_recent_stats": False
}
r = requests.post("${API_BASE}/analytics/generate-lineup",
                  json=payload, headers=headers)`,
          typescript: `const res = await fetch('${API_BASE}/analytics/generate-lineup', {
  method: 'POST',
  headers: {
    'X-API-Key': 'cv_your_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    team_id: 42,
    week: 18,
    streaming_slots: 2,
    use_recent_stats: false
  })
})`,
        },
        response: `{
  "status": "success",
  "data": {
    "week": 18,
    "projected_total_fpts": 24.0,
    "daily_lineups": [
      {
        "date": "Week 18, Day 1",
        "active_players": ["Nikola Jokic", "LeBron James", "Shai Gilgeous-Alexander"],
        "bench_players": [],
        "projected_fpts": 128.4
      }
    ],
    "recommended_moves": [
      {
        "action": "stream",
        "player_add": { "id": 0, "name": "Cason Wallace", "team": "OKC", "position": "", "avg_fpts": 18.6 },
        "player_drop": { "id": 0, "name": "Malik Monk", "team": "SAC", "position": "", "avg_fpts": 14.2 },
        "reason": "Day 1 streaming move",
        "projected_gain": 12.0
      }
    ],
    "optimization_notes": [
      "Week 18: +24 projected fpts from 2 streaming slot(s)"
    ]
  }
}`,
      },
      {
        method: "GET",
        path: "/analytics/breakout-streamers",
        description: "Get breakout streamer candidates — players likely to see increased minutes due to a prominent teammate being injured or suspended. Updated daily. Requires an API key with 'analytics' scope.",
        params: [
          { name: "limit", type: "integer", required: false, description: "Maximum candidates to return (1–50, default 20)" },
          { name: "team", type: "string", required: false, description: "Filter by team abbreviation (e.g. LAL, BOS)" },
        ],
        code: {
          curl: `curl -H "X-API-Key: cv_your_key" \\
  "${API_BASE}/analytics/breakout-streamers?limit=10"`,
          python: `import requests

headers = {"X-API-Key": "cv_your_key"}
r = requests.get("${API_BASE}/analytics/breakout-streamers",
                 params={"limit": 10},
                 headers=headers)
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/analytics/breakout-streamers?limit=10', {
  headers: { 'X-API-Key': 'cv_your_key' }
})
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": {
    "as_of_date": "2026-03-01",
    "candidates": [
      {
        "beneficiary": {
          "player_id": 1641705,
          "name": "Cason Wallace",
          "team": "OKC",
          "position": "G",
          "depth_rank": 2,
          "avg_min": 22.4,
          "avg_fpts": 18.6,
          "games_remaining": 24,
          "has_b2b": true
        },
        "injured_player": {
          "player_id": 1629029,
          "name": "Shai Gilgeous-Alexander",
          "avg_min": 34.2,
          "status": "Out",
          "expected_return": "2026-03-08"
        },
        "signals": {
          "depth_rank": 2,
          "projected_min_boost": 11.8,
          "opp_min_avg": 30.1,
          "opp_fpts_avg": 28.4,
          "opp_game_count": 5,
          "breakout_score": 87.3
        }
      }
    ]
  }
}`,
      },
    ],
  },
];

// Flat list of all endpoints for playground autocomplete
export const allEndpoints: Endpoint[] = categories.flatMap((c) => c.endpoints);
