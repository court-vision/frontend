# Court Vision – Frontend

The Next.js web application for [Court Vision](https://www.courtvision.dev), a fantasy basketball analytics platform. Provides player rankings, lineup optimization, live matchup scoring, streaming recommendations, and a Bloomberg Terminal-inspired analytics interface.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 3, shadcn/ui (Radix UI primitives) |
| Data fetching | TanStack Query v5 |
| State | Zustand 4 (with `persist` middleware) |
| Auth | Clerk (`@clerk/nextjs`) |
| Charts | Recharts |
| Drag & Drop | dnd-kit |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod |
| Package manager | Bun |
| Analytics | Vercel Analytics + Speed Insights |

---

## Directory Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout (Clerk, TanStack Query, Theme, Toaster)
│   ├── page.tsx                # Home – WelcomeView (signed out) or DashboardView
│   ├── rankings/               # Player rankings table (public)
│   ├── matchup/                # Current-week matchup analysis (auth required)
│   ├── streamers/              # Streaming pickup recommendations (auth required)
│   ├── lineup-generation/      # Lineup optimizer UI (auth required)
│   ├── manage-lineups/         # Saved lineup management (auth required)
│   ├── manage-teams/           # Add/edit/remove fantasy teams (auth required)
│   ├── your-teams/             # Team overview dashboard (auth required)
│   ├── terminal/               # Analytics terminal (public)
│   ├── query-builder/          # SQL-style query builder (auth required)
│   ├── developer/              # API key management (auth required)
│   ├── settings/               # User settings (auth required)
│   ├── account/                # Account management / email verification
│   ├── sign-in/                # Clerk sign-in page
│   └── sign-up/                # Clerk sign-up page
│
├── components/
│   ├── ui/                     # shadcn/ui primitives (Button, Dialog, etc.)
│   ├── Base.tsx                # App shell – sidebar nav + page wrapper
│   ├── dashboard/              # Home dashboard widgets (GameScoreTicker, StatCard, etc.)
│   ├── terminal/               # Analytics terminal components
│   │   ├── TerminalLayout.tsx  # Three-column resizable shell
│   │   ├── TerminalCommandBar.tsx  # Player/team search with autocomplete
│   │   ├── TerminalStatusBar.tsx   # Status bar with team carousel
│   │   ├── core/               # PanelRegistry, PanelContainer, PanelToolbar
│   │   └── panels/             # One file per panel type (20+ panels)
│   ├── rankings-components/    # Rankings table and filters
│   ├── matchup-components/     # Matchup score display
│   ├── streamers-components/   # Streamer cards and filters
│   ├── lineup-components/      # Lineup generation forms and results
│   ├── teams-components/       # Team management modals
│   └── settings/               # Notification preferences UI
│
├── hooks/                      # TanStack Query hooks (one file per domain)
│   ├── useTeams.ts             # useTeamsQuery, useTeamInsightsQuery, mutations
│   ├── useMatchup.ts           # useMatchupQuery, useLiveMatchupQuery, useWeeklyMatchupQuery
│   ├── useRankings.ts
│   ├── useStreamers.ts
│   ├── useLineups.ts
│   ├── usePlayer.ts
│   ├── useLiveStats.ts
│   ├── useGames.ts
│   └── ...
│
├── stores/                     # Zustand stores
│   ├── useUIStore.ts           # Selected team, provider, modal states, sidebar
│   ├── useTerminalStore.ts     # Terminal layout, focused player/team, watchlist
│   └── useDashboardStore.ts
│
├── lib/
│   ├── api.ts                  # ApiClient class – all backend calls
│   ├── auth.ts                 # buildAuthHeaders helper (Clerk token -> Bearer)
│   └── utils.ts                # cn(), getTodayET(), etc.
│
├── providers/
│   ├── QueryProvider.tsx       # TanStack Query client + devtools
│   └── CommandPaletteProvider.tsx
│
├── types/                      # TypeScript types per domain
│   ├── team.ts, player.ts, matchup.ts, lineup.ts, streamer.ts ...
│   └── terminal.ts             # PanelDefinition, TerminalState, etc.
│
├── endpoints.tsx               # Central API URL constants
└── middleware.ts               # Clerk auth middleware + robots header control
```

---

## Setup & Installation

**Prerequisites:** Node.js 20+ and [Bun](https://bun.sh) installed.

```bash
cd frontend
bun install
```

---

## Running Locally

```bash
bun run dev      # Start dev server at http://localhost:3000
bun run build    # Production build
bun run start    # Serve production build
bun run lint     # ESLint
```

---

## Environment Variables

Create a `.env.local` file in `frontend/`:

```env
# Clerk authentication (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Clerk redirect paths (optional, defaults shown)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

No other environment variables are required. The backend URL is controlled by a compile-time flag (see below).

---

## Toggling Local vs Production API

The API base URL is set in `src/endpoints.tsx`:

```ts
export const API_BASE =
  true   // <- flip this boolean
    ? PROD_BACKEND_ENDPOINT  // "https://api.courtvision.dev"
    : LOCAL_BACKEND_ENDPOINT // "http://127.0.0.1:8000"
```

Change `true` to `false` to point at a local backend instance running on port 8000.

---

## Pages & Routes

| Route | Auth | Description |
|---|---|---|
| `/` | Optional | Dashboard (DashboardView if signed in, WelcomeView if not) |
| `/rankings` | No | Player rankings table with model selector |
| `/terminal` | No | Analytics terminal (three-column panel layout) |
| `/matchup` | Yes | Current-week matchup analysis vs. opponent |
| `/streamers` | Yes | Streaming pickup recommendations + breakout candidates |
| `/lineup-generation` | Yes | AI-assisted lineup optimizer |
| `/manage-lineups` | Yes | View and manage saved lineups |
| `/manage-teams` | Yes | Connect ESPN/Yahoo teams via league ID |
| `/your-teams` | Yes | Per-team roster and schedule overview |
| `/query-builder` | Yes | SQL-style query interface for player data |
| `/developer` | Yes | API key management for public API access |
| `/settings` | Yes | Notification preferences |
| `/account` | Yes | Account info and email verification |

Route protection is enforced in `middleware.ts` via Clerk's `createRouteMatcher`. Public routes (`/`, `/rankings`, `/terminal`) also have their `X-Robots-Tag: noindex` header removed so search engines can index them.

---

## Architecture Patterns

### API Client (`src/lib/api.ts`)

A singleton `ApiClient` class wraps all backend calls. Two internal approaches handle the two auth tiers:

- **`authenticatedRequest`** – attaches a Clerk JWT (`Authorization: Bearer <token>`) for internal/user routes.
- Direct `fetch` calls – used for public routes (rankings, players, live stats) that need no auth.

All responses follow `BaseApiResponse<T>` with `{ status, message, data }`. The client unwraps `data` and throws on `status !== "success"`.

```ts
import { apiClient } from "@/lib/api";

// Authenticated
const teams = await apiClient.getTeams(getToken);

// Public
const rankings = await apiClient.getRankings();
```

### Data Fetching Hooks (`src/hooks/`)

Each domain has its own hook file exporting TanStack Query hooks and mutations. All authenticated hooks:

1. Call `useAuth()` from Clerk to get `getToken` and `isSignedIn`.
2. Pass `getToken` directly to `apiClient` methods.
3. Set `enabled: isSignedIn === true` so queries never fire before auth resolves.

Live-data hooks use `refetchInterval` to poll (e.g. `useLiveMatchupQuery` polls every 60 seconds, matching the backend pipeline cadence). The `useWeeklyMatchupQuery` hook seeds per-day cache entries after loading so `useDailyMatchupQuery` gets instant cache hits.

Query key factories follow the TanStack Query recommended pattern:

```ts
export const teamsKeys = {
  all: ["teams"] as const,
  lists: () => [...teamsKeys.all, "list"] as const,
  detail: (id: number) => [...teamsKeys.all, "detail", id] as const,
};
```

### State Management (`src/stores/`)

| Store | Persisted fields | Purpose |
|---|---|---|
| `useUIStore` | selectedTeam, selectedProvider, selectedRankingModel, selectedLineupWeek | Cross-page UI selections |
| `useTerminalStore` | watchlist, recentlyViewed, layout, statWindow, lastFocusedTeamId | Terminal panel layout and player/team focus |
| `useDashboardStore` | — | Dashboard widget state |

All stores use Zustand's `persist` middleware with `partialize` to persist only the fields that should survive a page reload.

### Analytics Terminal (`/terminal`)

The terminal is a three-column resizable layout built with `react-resizable-panels`. It supports three modes:

- **Overview** – no focused player or team; shows market panels (trending, schedule, today's leaders)
- **Player Mode** – `focusedPlayerId` set; left/right panels show player-specific data
- **Team Mode** – `focusedTeamId` set; panels show roster, live matchup score, category strengths

Panels are registered in `src/components/terminal/core/PanelRegistry.ts`. Adding a new panel type means:
1. Adding a `PanelDefinition` entry to `PANEL_REGISTRY`
2. Creating the panel component in `src/components/terminal/panels/`
3. Adding the `case` to `PanelContainer`'s render switch

**Available panel categories:**

| Category | Panels |
|---|---|
| player | Player Focus, Advanced Stats, Performance Chart, Game Log, Team Schedule, Matchup Context |
| team | Roster Overview, Matchup, Category Strengths, Score History, Daily Breakdown, Lineup Optimizer, Team Streamers |
| comparison | Comparison |
| market | Watchlist, Trending, Today's Leaders, Streamers |
| schedule | Schedule |

The command bar (`TerminalCommandBar`) merges team and player search results (teams shown first). The status bar (`TerminalStatusBar`) shows a team carousel (`{`/`}` keys cycle teams).

**Keyboard shortcuts:**
- `[` / `]` – toggle left/right panels
- `,` / `.` / `<` / `>` – resize panels
- `Escape` – clears focus (Player Mode → Team Mode → Overview)

### Context Providers (root layout)

The root layout composes providers in this order (outermost to innermost):

```
ClerkProvider
  QueryProvider (TanStack Query)
    TeamsProvider (React context – team list for nav)
      LineupProvider (React context – active lineup state)
        ThemeProvider (next-themes, forced dark)
          CommandPaletteProvider
            Layout (Base.tsx – sidebar shell)
```

### Player ID Convention

Two player ID systems coexist throughout the codebase:

- **ESPN Player ID** – sourced from ESPN Fantasy API; used by streamers, rosters, and breakout candidates
- **NBA Player ID** – sourced from nba_api; used by terminal panels, percentiles, player status, and ownership history

Terminal panels require NBA IDs. When navigating from an ESPN-sourced component to a terminal panel, the NBA ID must be resolved first. Backend responses for ESPN-sourced data expose an `nba_player_id` field for this purpose.

---

## How It Fits Into Court Vision

```
cron-runner (Go)
      |  triggers pipelines on schedule
      v
data-platform (FastAPI, port 8001)
      |  ETL: fetches NBA/ESPN data, writes to PostgreSQL
      v
backend (FastAPI, port 8000)
      |  user-facing REST API
      v
frontend (Next.js, port 3000)   <-- this repo
      |  reads backend for user data
      |  reads public endpoints without auth (rankings, players, live)
      |  sends lineup generation requests -> features service (Go, port 8080)
```

The frontend never talks to the data platform or cron-runner directly. All requests go through the backend REST API (`https://api.courtvision.dev` in production).

Public endpoints (`/v1/rankings`, `/v1/players`, `/v1/live`, `/v1/games`) require no authentication and are called directly via `fetch`. Authenticated endpoints (`/v1/internal/...`) require a Clerk JWT sent as `Authorization: Bearer <token>`.
