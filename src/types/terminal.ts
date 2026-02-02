import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Panel system types
export type PanelCategory = "player" | "comparison" | "market" | "schedule";

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

// Stat window for time-based filtering
export type StatWindow = "season" | "l5" | "l10" | "l20";

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

  // Watchlist (persisted)
  watchlist: WatchlistPlayer[];
  recentlyViewed: number[];

  // Layout state
  layout: LayoutState;

  // View options
  statWindow: StatWindow;

  // Command history
  commandHistory: string[];

  // Actions
  setFocusedPlayer: (id: number | null) => void;
  addToComparison: (id: number) => void;
  removeFromComparison: (id: number) => void;
  clearComparison: () => void;
  addToWatchlist: (id: number) => void;
  removeFromWatchlist: (id: number) => void;
  addRecentView: (id: number) => void;
  setLayoutPreset: (preset: LayoutPreset) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelSize: (size: number) => void;
  setRightPanelSize: (size: number) => void;
  setStatWindow: (window: StatWindow) => void;
  addToCommandHistory: (command: string) => void;
  addCenterPanel: (panel: PanelInstance) => void;
  removeCenterPanel: (panelId: string) => void;
}
