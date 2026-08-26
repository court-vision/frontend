import type { DashboardLayout, LayoutTemplate } from "@/types/dashboard";
import type { ScoringFormat } from "@/types/scoring";

/** Default layout for users without a selected team (or logged-out) */
const DEFAULT_LAYOUT: DashboardLayout = {
  cols: 12,
  widgets: [
    // Row 1: Leaders + Schedule + Trending
    {
      i: "default-leaders",
      definitionId: "today-leaders",
      x: 0,
      y: 0,
      w: 5,
      h: 5,
      minW: 3,
      minH: 4,
    },
    {
      i: "default-schedule",
      definitionId: "schedule",
      x: 5,
      y: 0,
      w: 4,
      h: 5,
      minW: 2,
      minH: 4,
    },
    {
      i: "default-trending",
      definitionId: "trending",
      x: 9,
      y: 0,
      w: 3,
      h: 5,
      minW: 2,
      minH: 3,
    },
    // Row 2: Streamers + Watchlist + Quick Actions
    {
      i: "default-streamers",
      definitionId: "streamers",
      x: 0,
      y: 5,
      w: 5,
      h: 5,
      minW: 2,
      minH: 4,
    },
    {
      i: "default-watchlist",
      definitionId: "watchlist",
      x: 5,
      y: 5,
      w: 4,
      h: 5,
      minW: 2,
      minH: 3,
    },
    {
      i: "default-actions",
      definitionId: "quick-actions",
      x: 9,
      y: 5,
      w: 3,
      h: 2,
      minW: 2,
      minH: 2,
    },
  ],
};

/** Default layout template when a team is selected */
const TEAM_LAYOUT: DashboardLayout = {
  cols: 12,
  widgets: [
    // Top row: Matchup score + Roster + Team Streamers
    {
      i: "team-matchup",
      definitionId: "matchup-score",
      x: 0,
      y: 0,
      w: 5,
      h: 5,
      minW: 3,
      minH: 3,
    },
    {
      i: "team-roster",
      definitionId: "roster-overview",
      x: 5,
      y: 0,
      w: 4,
      h: 7,
      minW: 3,
      minH: 4,
    },
    {
      i: "team-streamers",
      definitionId: "team-streamers",
      x: 9,
      y: 0,
      w: 3,
      h: 5,
      minW: 2,
      minH: 4,
    },
    // Second row: Daily breakdown + Score history
    {
      i: "team-daily",
      definitionId: "daily-breakdown",
      x: 0,
      y: 5,
      w: 5,
      h: 4,
      minW: 3,
      minH: 3,
    },
    {
      i: "team-history",
      definitionId: "score-history",
      x: 9,
      y: 5,
      w: 3,
      h: 4,
      minW: 2,
      minH: 3,
    },
  ],
};

/**
 * Default layout template for a category-league team: the category breakdown
 * leads, the points score chart is replaced by category strengths.
 */
const CATEGORY_LAYOUT: DashboardLayout = {
  cols: 12,
  widgets: [
    // Top row: Category breakdown + Roster + Team Streamers
    {
      i: "cat-comparison",
      definitionId: "category-comparison",
      x: 0,
      y: 0,
      w: 5,
      h: 5,
      minW: 3,
      minH: 3,
    },
    {
      i: "cat-roster",
      definitionId: "roster-overview",
      x: 5,
      y: 0,
      w: 4,
      h: 7,
      minW: 3,
      minH: 4,
    },
    {
      i: "cat-streamers",
      definitionId: "team-streamers",
      x: 9,
      y: 0,
      w: 3,
      h: 5,
      minW: 2,
      minH: 4,
    },
    // Second row: Matchup score + Category strengths
    {
      i: "cat-matchup",
      definitionId: "matchup-score",
      x: 0,
      y: 5,
      w: 5,
      h: 5,
      minW: 3,
      minH: 3,
    },
    {
      i: "cat-strengths",
      definitionId: "category-strengths",
      x: 9,
      y: 5,
      w: 3,
      h: 4,
      minW: 3,
      minH: 3,
    },
    {
      i: "cat-daily",
      definitionId: "daily-breakdown",
      x: 5,
      y: 7,
      w: 4,
      h: 4,
      minW: 3,
      minH: 3,
    },
  ],
};

export const DEFAULT_LAYOUTS: Record<LayoutTemplate, DashboardLayout> = {
  default: DEFAULT_LAYOUT,
  team: TEAM_LAYOUT,
  categories: CATEGORY_LAYOUT,
};

/** Which template seeds a dashboard for the given selection + scoring format. */
export function layoutTemplateFor(
  selectedTeam: number | null,
  format: ScoringFormat
): LayoutTemplate {
  if (selectedTeam === null) return "default";
  return format === "categories" ? "categories" : "team";
}

/**
 * Widget order for the single-column phone stack, per template (definition
 * ids, top → bottom). Widgets not listed here follow in grid reading order —
 * see `orderForMobile` in `lib/dashboard-order.ts`.
 */
export const MOBILE_ORDER: Record<LayoutTemplate, string[]> = {
  default: [
    "today-leaders",
    "schedule",
    "streamers",
    "trending",
    "watchlist",
    "quick-actions",
  ],
  team: [
    "matchup-score",
    "daily-breakdown",
    "score-history",
    "roster-overview",
    "team-streamers",
  ],
  categories: [
    "category-comparison",
    "matchup-score",
    "category-strengths",
    "daily-breakdown",
    "roster-overview",
    "team-streamers",
  ],
};
