import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Lineup } from "./lineup";

// Panel system types
export type PanelCategory = "player" | "comparison" | "market" | "schedule" | "team" | "nba-team";

export interface PanelDefinition {
  id: string;
  name: string;
  icon: LucideIcon;
  category: PanelCategory;
  description?: string;
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
}

export interface PanelProps {
  panelId: string;
  isMaximized?: boolean;
  onMaximize?: () => void;
  onClose?: () => void;
}

export interface PanelInstance {
  id: string;
  definitionId: string;
  position: GridPosition;
  size?: { width: number; height: number };
}

export interface GridPosition {
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
}

// Layout types
export type LayoutPreset = "default" | "chart" | "comparison" | "data";

export interface PanelLayout {
  panels: PanelInstance[];
  gridColumns: number;
  gridRows: number;
}

export interface LayoutState {
  preset: LayoutPreset;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  leftPanelSize: number;
  rightPanelSize: number;
  centerPanels: PanelInstance[];
}

// Stat window for time-based filtering (supports "season" or any "lN" like "l5", "l10", "l15", etc.)
export type StatWindow = string;

// Command bar types
export interface CommandDefinition {
  command: string;
  aliases?: string[];
  description: string;
  handler: (args: string[]) => void;
}

export interface SearchResult {
  id: number;
  name: string;
  team: string;
  position?: string;
}

// Player comparison types
export interface ComparisonPlayer {
  id: number;
  name: string;
  team: string;
}

// Watchlist types
export interface WatchlistPlayer {
  id: number;
  addedAt: number;
}

// Advanced stats (matches backend PlayerAdvancedStats)
export interface AdvancedStats {
  player_id: number;
  season: string;
  off_rating: number;
  def_rating: number;
  net_rating: number;
  ts_pct: number;
  efg_pct: number;
  usg_pct: number;
  ast_pct: number;
  ast_to_tov: number;
  ast_ratio: number;
  reb_pct: number;
  oreb_pct: number;
  dreb_pct: number;
  tov_pct: number;
  pace: number;
  pie: number;
  poss: number;
  plus_minus: number;
}

// Terminal store state interface
export interface TerminalState {
  // Player focus
  focusedPlayerId: number | null;
  comparisonPlayerIds: number[];

  // Fantasy team focus
  focusedTeamId: number | null;

  // NBA team focus (3-letter abbreviation, e.g. "LAL")
  focusedNBATeamId: string | null;

  // Watchlist (persisted)
  watchlist: WatchlistPlayer[];
  recentlyViewed: number[];

  // Last focused team (persisted, for session restore)
  lastFocusedTeamId: number | null;
  lastFocusedNBATeamId: string | null;

  // Layout state
  layout: LayoutState;

  // View options
  statWindow: StatWindow;

  // Command history
  commandHistory: string[];

  // Generated lineup (shared between LineupOptimizer and MatchupPanel)
  generatedLineup: Lineup | null;

  // Actions
  setFocusedPlayer: (id: number | null) => void;
  addToComparison: (id: number) => void;
  removeFromComparison: (id: number) => void;
  clearComparison: () => void;
  addToWatchlist: (id: number) => void;
  removeFromWatchlist: (id: number) => void;
  addRecentView: (id: number) => void;
  setFocusedTeam: (id: number | null) => void;
  cycleTeam: (teamIds: number[], direction: 1 | -1) => void;
  setFocusedNBATeam: (abbrev: string | null) => void;
  setLayoutPreset: (preset: LayoutPreset) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelSize: (size: number) => void;
  setRightPanelSize: (size: number) => void;
  setStatWindow: (window: StatWindow) => void;
  addToCommandHistory: (command: string) => void;
  setGeneratedLineup: (lineup: Lineup | null) => void;
  addCenterPanel: (panel: PanelInstance) => void;
  removeCenterPanel: (panelId: string) => void;
}
