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
        description: "List all players in the database with optional filtering.",
        params: [
          { name: "name", type: "string", required: false, description: "Filter by player name (partial match)" },
          { name: "team", type: "string", required: false, description: "Filter by team abbreviation (e.g. LAL)" },
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
  "data": [
    {
      "id": 2544,
      "name": "LeBron James",
      "team": "LAL",
      "position": "SF"
    }
  ]
}`,
      },
      {
        method: "GET",
        path: "/players/stats",
        description: "Get detailed statistics for a player by name.",
        params: [
          { name: "name", type: "string", required: true, description: "Player name (exact or partial match)" },
          { name: "season", type: "string", required: false, description: 'NBA season (default: current, e.g. "2025-26")' },
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
    "player": "LeBron James",
    "team": "LAL",
    "games_played": 52,
    "ppg": 23.8,
    "rpg": 7.6,
    "apg": 8.9,
    "fpts_avg": 48.2
  }
}`,
      },
      {
        method: "GET",
        path: "/players/{id}/games",
        description: "Get game-by-game log for a specific player.",
        params: [
          { name: "id", type: "integer", required: true, description: "Player ID (path parameter)" },
          { name: "last_n", type: "integer", required: false, description: "Return only last N games" },
        ],
        code: {
          curl: `curl -H "X-API-Key: cv_your_key" \\
  "${API_BASE}/players/2544/games?last_n=5"`,
          python: `import requests

headers = {"X-API-Key": "cv_your_key"}
r = requests.get("${API_BASE}/players/2544/games",
                 params={"last_n": 5},
                 headers=headers)`,
          typescript: `const res = await fetch('${API_BASE}/players/2544/games?last_n=5', {
  headers: { 'X-API-Key': 'cv_your_key' }
})`,
        },
        response: `{
  "status": "success",
  "data": [
    {
      "date": "2026-02-23",
      "opponent": "BOS",
      "pts": 28, "reb": 9, "ast": 11,
      "fpts": 54.3
    }
  ]
}`,
      },
      {
        method: "GET",
        path: "/players/{id}/trends",
        description: "Get rolling average trends for a player over configurable windows.",
        params: [
          { name: "id", type: "integer", required: true, description: "Player ID (path parameter)" },
          { name: "windows", type: "string", required: false, description: 'Comma-separated windows (default: "5,10,20")' },
        ],
        code: {
          curl: `curl -H "X-API-Key: cv_your_key" \\
  "${API_BASE}/players/2544/trends?windows=5,10"`,
          python: `import requests

headers = {"X-API-Key": "cv_your_key"}
r = requests.get("${API_BASE}/players/2544/trends",
                 params={"windows": "5,10"},
                 headers=headers)`,
          typescript: `const res = await fetch('${API_BASE}/players/2544/trends?windows=5,10', {
  headers: { 'X-API-Key': 'cv_your_key' }
})`,
        },
        response: `{
  "status": "success",
  "data": {
    "l5": { "ppg": 25.2, "rpg": 8.0, "apg": 9.4, "fpts": 51.0 },
    "l10": { "ppg": 24.1, "rpg": 7.8, "apg": 8.7, "fpts": 49.3 }
  }
}`,
      },
      {
        method: "GET",
        path: "/players/{id}/percentiles",
        description: "Get a player's statistical percentile rankings among all players.",
        params: [
          { name: "id", type: "integer", required: true, description: "Player ID (path parameter)" },
        ],
        code: {
          curl: `curl -H "X-API-Key: cv_your_key" \\
  "${API_BASE}/players/2544/percentiles"`,
          python: `import requests

headers = {"X-API-Key": "cv_your_key"}
r = requests.get("${API_BASE}/players/2544/percentiles",
                 headers=headers)`,
          typescript: `const res = await fetch('${API_BASE}/players/2544/percentiles', {
  headers: { 'X-API-Key': 'cv_your_key' }
})`,
        },
        response: `{
  "status": "success",
  "data": {
    "ppg": 94, "rpg": 82, "apg": 97,
    "fpts": 96, "stocks": 55, "efficiency": 91
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
        description: "Get fantasy basketball player rankings with scoring and category data.",
        params: [
          { name: "page", type: "integer", required: false, description: "Page number (default: 1)" },
          { name: "per_page", type: "integer", required: false, description: "Results per page (default: 100, max: 300)" },
          { name: "sort_by", type: "string", required: false, description: 'Sort field (default: "fpts_avg")' },
        ],
        code: {
          curl: `curl "${API_BASE}/rankings/?per_page=20&sort_by=fpts_avg"`,
          python: `import requests

r = requests.get("${API_BASE}/rankings/",
                 params={"per_page": 20, "sort_by": "fpts_avg"})
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/rankings/?per_page=20&sort_by=fpts_avg')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": [
    {
      "rank": 1,
      "name": "Nikola Jokic",
      "team": "DEN",
      "fpts_avg": 62.4,
      "ppg": 26.1, "rpg": 12.3, "apg": 9.8
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
          { name: "date", type: "string", required: true, description: 'Date in YYYY-MM-DD format (path parameter). Use "today" for current date.' },
        ],
        code: {
          curl: `curl "${API_BASE}/games/2026-02-25"`,
          python: `import requests

r = requests.get("${API_BASE}/games/2026-02-25")
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/games/2026-02-25')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": [
    {
      "game_id": "0022500789",
      "home_team": "LAL", "away_team": "BOS",
      "home_score": 104, "away_score": 98,
      "status": "In Progress",
      "period": 3, "clock": "4:32"
    }
  ]
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
        description: "Get the NBA fantasy week schedule including start/end dates and game counts.",
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
  "data": {
    "current_week": 18,
    "weeks": [
      { "week": 18, "start": "2026-02-23", "end": "2026-03-01", "games": 42 }
    ]
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
        description: "Get the remaining schedule for an NBA team including opponents and home/away.",
        params: [
          { name: "abbrev", type: "string", required: true, description: "Team abbreviation (e.g. LAL, BOS, GSW)" },
        ],
        code: {
          curl: `curl "${API_BASE}/teams/LAL/schedule"`,
          python: `import requests

r = requests.get("${API_BASE}/teams/LAL/schedule")
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/teams/LAL/schedule')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": [
    {
      "date": "2026-02-26",
      "opponent": "GSW",
      "home": true,
      "time": "10:00 PM ET"
    }
  ]
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
        description: "Get trending player ownership changes in fantasy leagues. Shows adds, drops, and net changes.",
        params: [
          { name: "limit", type: "integer", required: false, description: "Number of players to return (default: 25)" },
          { name: "direction", type: "string", required: false, description: '"up" or "down" (default: "up")' },
        ],
        code: {
          curl: `curl "${API_BASE}/ownership/trending?limit=10&direction=up"`,
          python: `import requests

r = requests.get("${API_BASE}/ownership/trending",
                 params={"limit": 10, "direction": "up"})
data = r.json()`,
          typescript: `const res = await fetch('${API_BASE}/ownership/trending?limit=10&direction=up')
const data = await res.json()`,
        },
        response: `{
  "status": "success",
  "data": [
    {
      "name": "Jalen Williams",
      "team": "OKC",
      "ownership_pct": 89.2,
      "change_7d": +12.4
    }
  ]
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
        description: "Get live player stats for all games in progress today. Updates every 60 seconds during game time.",
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
  "data": [
    {
      "player_id": 2544,
      "name": "LeBron James",
      "game_id": "0022500789",
      "pts": 18, "reb": 5, "ast": 7,
      "fpts": 32.1,
      "minutes": "PT24M30.00S"
    }
  ]
}`,
      },
      {
        method: "GET",
        path: "/live/scoreboard",
        description: "Get the live NBA scoreboard with all current game scores and statuses.",
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
    "games": [
      {
        "game_id": "0022500789",
        "home_team": "LAL", "away_team": "BOS",
        "home_score": 104, "away_score": 98,
        "period": 3, "clock": "4:32",
        "status": "In Progress"
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
        path: "/analytics/optimize",
        description: "Run lineup optimization for a fantasy roster. Suggests optimal adds/drops to maximize weekly fantasy points. Requires an API key with 'optimize' scope.",
        params: [
          { name: "roster_data", type: "object[]", required: true, description: "Array of current roster player objects" },
          { name: "free_agent_data", type: "object[]", required: true, description: "Array of available free agent player objects" },
          { name: "week", type: "integer", required: true, description: "Target fantasy week number" },
          { name: "threshold", type: "number", required: false, description: "Minimum FPTS improvement threshold (default: 2.0)" },
        ],
        code: {
          curl: `curl -X POST -H "X-API-Key: cv_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"roster_data": [...], "free_agent_data": [...], "week": 18}' \\
  "${API_BASE}/analytics/optimize"`,
          python: `import requests

headers = {
    "X-API-Key": "cv_your_key",
    "Content-Type": "application/json"
}
payload = {
    "roster_data": [...],
    "free_agent_data": [...],
    "week": 18,
    "threshold": 2.0
}
r = requests.post("${API_BASE}/analytics/optimize",
                  json=payload, headers=headers)`,
          typescript: `const res = await fetch('${API_BASE}/analytics/optimize', {
  method: 'POST',
  headers: {
    'X-API-Key': 'cv_your_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    roster_data: [...],
    free_agent_data: [...],
    week: 18,
    threshold: 2.0
  })
})`,
        },
        response: `{
  "status": "success",
  "data": {
    "recommendations": [
      {
        "action": "add",
        "player": "Jalen Williams",
        "drop": "Malik Monk",
        "fpts_gain": 8.4,
        "reason": "3 more games this week"
      }
    ],
    "projected_fpts": 412.5
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
