"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Data Types ────────────────────────────────────────────

interface Param {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface CodeExample {
  curl: string;
  python: string;
  typescript: string;
}

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  description: string;
  params: Param[];
  code: CodeExample;
  response: string;
}

interface EndpointCategory {
  id: string;
  label: string;
  endpoints: Endpoint[];
}

// ─── API Data ──────────────────────────────────────────────

const API_BASE = "https://api.courtvision.dev/v1";

const categories: EndpointCategory[] = [
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
        description: "Get fantasy basketball player rankings. Use window for rolling averages over the last 7, 14, or 30 days. Omit for full-season rankings.",
        params: [
          { name: "window", type: "integer", required: false, description: "Rolling day window: 7, 14, or 30. Omit for full-season rankings." },
        ],
        code: {
          curl: `curl "${API_BASE}/rankings/?window=14"`,
          python: `import requests

r = requests.get("${API_BASE}/rankings/",
                 params={"window": 14})
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/rankings/?window=14')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": [
    {
      "id": 203999,
      "rank": 1,
      "player_name": "Nikola Jokic",
      "team": "DEN",
      "total_fpts": 3244.8,
      "avg_fpts": 62.4,
      "rank_change": 0
    },
    {
      "id": 1629029,
      "rank": 2,
      "player_name": "Shai Gilgeous-Alexander",
      "team": "OKC",
      "total_fpts": 2987.1,
      "avg_fpts": 58.6,
      "rank_change": 1
    }
  ]
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
        description: "Get all NBA fantasy week dates and the current week number.",
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
      { "week": 17, "start_date": "2026-02-16", "end_date": "2026-02-22" },
      { "week": 18, "start_date": "2026-02-23", "end_date": "2026-03-01" }
    ],
    "current_week": 18
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
          { name: "week", type: "integer", required: true, description: "Target fantasy week to optimize for (1–26)" },
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

// ─── Syntax highlighting ───────────────────────────────────

function highlightJson(json: string): React.ReactNode[] {
  const lines = json.split("\n");
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    // Match and colorize JSON tokens
    const regex = /("(?:\\"|[^"])*")\s*(:?)|\b(true|false|null)\b|(-?\d+\.?\d*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(remaining)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{remaining.slice(lastIndex, match.index)}</span>);
      }

      if (match[1] && match[2]) {
        // Key
        parts.push(<span key={key++} className="text-sky-400">{match[1]}</span>);
        parts.push(<span key={key++}>{match[2]}</span>);
      } else if (match[1]) {
        // String value
        parts.push(<span key={key++} className="text-emerald-400">{match[1]}</span>);
      } else if (match[3]) {
        // Boolean / null
        parts.push(<span key={key++} className="text-amber-400">{match[3]}</span>);
      } else if (match[4]) {
        // Number
        parts.push(<span key={key++} className="text-violet-400">{match[4]}</span>);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < remaining.length) {
      parts.push(<span key={key++}>{remaining.slice(lastIndex)}</span>);
    }

    return (
      <div key={i} className="leading-relaxed">
        {parts.length > 0 ? parts : remaining}
      </div>
    );
  });
}

function highlightCode(code: string, lang: "curl" | "python" | "typescript"): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    let lastIndex = 0;

    // Comments
    if (remaining.trimStart().startsWith("#") || remaining.trimStart().startsWith("//")) {
      return (
        <div key={i} className="leading-relaxed text-muted-foreground/60">{remaining}</div>
      );
    }

    // Keywords pattern based on language
    let regex: RegExp;
    if (lang === "python") {
      regex = /("(?:\\"|[^"])*"|'(?:\\'|[^'])*')|\b(import|from|def|return|class|if|else|for|in|as|True|False|None)\b/g;
    } else if (lang === "typescript") {
      regex = /("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|`(?:\\`|[^`])*`)|\b(const|let|var|await|async|function|return|import|from|new|typeof)\b/g;
    } else {
      // curl
      regex = /("(?:\\"|[^"])*"|'(?:\\'|[^'])*')|\b(curl)\b|(-[XHGF]|--\w[\w-]*)/g;
    }

    let match: RegExpExecArray | null;
    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{remaining.slice(lastIndex, match.index)}</span>);
      }

      if (match[1]) {
        // String
        parts.push(<span key={key++} className="text-emerald-400">{match[1]}</span>);
      } else if (match[2]) {
        // Keyword
        parts.push(<span key={key++} className="text-violet-400">{match[2]}</span>);
      } else if (match[3]) {
        // Flag (curl)
        parts.push(<span key={key++} className="text-sky-400">{match[3]}</span>);
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < remaining.length) {
      parts.push(<span key={key++}>{remaining.slice(lastIndex)}</span>);
    }

    return (
      <div key={i} className="leading-relaxed">
        {parts.length > 0 ? parts : remaining}
      </div>
    );
  });
}

// ─── Sub-components ────────────────────────────────────────

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase",
        method === "GET"
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
          : "bg-amber-500/15 text-amber-400 border border-amber-500/25"
      )}
    >
      {method}
    </span>
  );
}

function CodeTabs({ code, id }: { code: CodeExample; id: string }) {
  const [tab, setTab] = useState<"curl" | "python" | "typescript">("curl");
  const tabs = [
    { key: "curl" as const, label: "cURL" },
    { key: "python" as const, label: "Python" },
    { key: "typescript" as const, label: "TypeScript" },
  ];

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      <div className="flex items-center border-b border-border/60 bg-muted/30">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 text-[10px] font-medium font-mono transition-colors",
              tab === t.key
                ? "text-primary bg-background border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-3 bg-[hsl(var(--card)/0.3)] overflow-x-auto">
        <pre className="font-mono text-[11px] leading-relaxed">
          <code>{highlightCode(code[tab], tab)}</code>
        </pre>
      </div>
    </div>
  );
}

function CollapsibleResponse({ response }: { response: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Response Example
      </button>
      {open && (
        <div className="p-3 bg-[hsl(var(--card)/0.3)] overflow-x-auto border-t border-border/60">
          <pre className="font-mono text-[11px]">
            <code>{highlightJson(response)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  return (
    <div className="space-y-3 pb-5 border-b border-border/30 last:border-0 last:pb-0">
      {/* Method + path + description */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <MethodBadge method={endpoint.method} />
          <code className="font-mono text-sm text-foreground">{endpoint.path}</code>
        </div>
        <p className="text-xs text-muted-foreground">{endpoint.description}</p>
      </div>

      {/* Parameters table */}
      {endpoint.params.length > 0 && (
        <div className="rounded-md border border-border/60 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-muted/30 border-b border-border/60">
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Parameter</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Type</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Required</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[9px]">Description</th>
              </tr>
            </thead>
            <tbody>
              {endpoint.params.map((p) => (
                <tr key={p.name} className="border-b border-border/30 last:border-0">
                  <td className="px-3 py-1.5 font-mono text-sky-400">{p.name}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{p.type}</td>
                  <td className="px-3 py-1.5">
                    {p.required ? (
                      <span className="text-amber-400 font-medium">Yes</span>
                    ) : (
                      <span className="text-muted-foreground/50">No</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Code examples */}
      <CodeTabs code={endpoint.code} id={endpoint.path} />

      {/* Response */}
      <CollapsibleResponse response={endpoint.response} />
    </div>
  );
}

function CategorySection({ category }: { category: EndpointCategory }) {
  return (
    <section id={`section-${category.id}`} className="scroll-mt-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold tracking-tight">{category.label}</h3>
        <span className="text-[10px] text-muted-foreground/50 font-mono">
          {category.endpoints.length} endpoint{category.endpoints.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-5">
        {category.endpoints.map((ep) => (
          <EndpointCard key={`${ep.method}-${ep.path}`} endpoint={ep} />
        ))}
      </div>
    </section>
  );
}

// ─── Main Component ────────────────────────────────────────

const SCROLL_OFFSET = 56; // 44px header (h-11) + 12px breathing room

export function ApiDocs() {
  const [activeSection, setActiveSection] = useState(categories[0].id);
  const contentRef = useRef<HTMLDivElement>(null);

  const getScrollContainer = () => {
    const container = contentRef.current?.closest("main");
    return container instanceof HTMLElement ? container : null;
  };

  const getSectionElement = (id: string) =>
    contentRef.current?.querySelector<HTMLElement>(`#section-${id}`) ?? null;

  const scrollToSection = (id: string) => {
    const el = getSectionElement(id);
    if (!el) return;

    const main = getScrollContainer();
    if (main) {
      const top =
        el.getBoundingClientRect().top -
        main.getBoundingClientRect().top +
        main.scrollTop -
        SCROLL_OFFSET;
      main.scrollTo({ top, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (window.location.hash !== `#section-${id}`) {
      window.history.replaceState(null, "", `#section-${id}`);
    }
  };

  // Observe which section is currently in view
  useEffect(() => {
    const main = getScrollContainer();
    const sections = contentRef.current?.querySelectorAll("[id^='section-']");
    if (!sections?.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("section-", "");
            setActiveSection(id);
          }
        }
      },
      { root: main ?? null, rootMargin: "-20% 0px -70% 0px" }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#section-")) return;
    const id = hash.replace("#section-", "");
    requestAnimationFrame(() => {
      const el = getSectionElement(id);
      if (!el) return;

      const main = getScrollContainer();
      if (main) {
        const top =
          el.getBoundingClientRect().top -
          main.getBoundingClientRect().top +
          main.scrollTop -
          SCROLL_OFFSET;
        main.scrollTo({ top, behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, []);

  return (
    <div className="flex gap-6 items-start">
      {/* Sidebar nav - desktop only */}
      <nav className="hidden lg:block shrink-0 w-36 sticky top-4 space-y-3">
        <div className="space-y-0.5">
          <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">Endpoints</p>
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`#section-${cat.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToSection(cat.id);
              }}
              className={cn(
                "block px-2 py-1 rounded text-[11px] font-medium transition-colors",
                activeSection === cat.id
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {cat.label}
              <span className="ml-1 text-[9px] text-muted-foreground/40 font-mono">
                {cat.endpoints.length}
              </span>
            </a>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div ref={contentRef} className="flex-1 min-w-0 space-y-8">
        {/* Overview */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight mb-1">API Reference</h2>
            <p className="text-xs text-muted-foreground">
              The Court Vision API provides programmatic access to fantasy basketball data including player stats, rankings, live scores, and lineup optimization.
            </p>
          </div>

          {/* Base URL */}
          <div className="rounded-md border border-border/60 p-3 bg-card/40 space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider w-20 shrink-0">Base URL</span>
              <code className="font-mono text-xs text-primary">{API_BASE}</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider w-20 shrink-0">Auth</span>
              <code className="font-mono text-xs text-foreground">X-API-Key: cv_xxxxxx</code>
              <span className="text-[10px] text-muted-foreground">header (optional for public endpoints)</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider w-20 shrink-0">Rate Limits</span>
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" className="text-[9px] px-1 py-0">No key</Badge>
                  <span className="font-mono text-muted-foreground">100 req/min</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-[9px] px-1 py-0">With key</Badge>
                  <span className="font-mono text-foreground">1,000 req/min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Response format */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Response Format</p>
            <div className="rounded-md border border-border/60 p-3 bg-[hsl(var(--card)/0.3)] overflow-x-auto">
              <pre className="font-mono text-[11px]">
                <code>
                  {highlightJson(`{
  "status": "success",
  "message": "Description of the result",
  "data": { ... }
}`)}
                </code>
              </pre>
            </div>
            <p className="text-[10px] text-muted-foreground">
              All responses follow the <code className="font-mono text-[10px] text-foreground bg-muted/50 px-1 rounded">BaseApiResponse</code> schema. Errors return <code className="font-mono text-[10px] text-foreground bg-muted/50 px-1 rounded">status: &quot;error&quot;</code> with a descriptive message.
            </p>
          </div>
        </section>

        {/* Endpoint categories */}
        {categories.map((cat) => (
          <CategorySection key={cat.id} category={cat} />
        ))}
      </div>
    </div>
  );
}
