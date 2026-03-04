"use client";

import { useTerminalStore } from "@/stores/useTerminalStore";
import { useTeamsQuery } from "@/hooks/useTeams";
import { cn } from "@/lib/utils";

interface TerminalStatusBarProps {
  className?: string;
}

export function TerminalStatusBar({ className }: TerminalStatusBarProps) {
  const { layout, focusedPlayerId, focusedTeamId, comparisonPlayerIds, watchlist, statWindow } =
    useTerminalStore();
  const { data: teams } = useTeamsQuery();

  const isTeamMode = focusedTeamId !== null && focusedPlayerId === null;
  const focusedTeam = isTeamMode ? teams?.find((t) => t.team_id === focusedTeamId) : null;
  const prevTeam = isTeamMode && teams && teams.length > 1
    ? teams[(teams.findIndex((t) => t.team_id === focusedTeamId) - 1 + teams.length) % teams.length]
    : null;
  const nextTeam = isTeamMode && teams && teams.length > 1
    ? teams[(teams.findIndex((t) => t.team_id === focusedTeamId) + 1) % teams.length]
    : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between h-6 px-3 border-t border-border/50 bg-muted/20",
        "text-[10px] font-mono text-muted-foreground",
        className
      )}
    >
      {/* Left section - Keyboard hints */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline">
          <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">/</kbd> search
        </span>
        <span className="hidden md:inline">
          <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">[</kbd>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] ml-0.5">]</kbd> toggle
        </span>
        <span className="hidden lg:inline">
          <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">,</kbd>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] ml-0.5">.</kbd> resize L
        </span>
        <span className="hidden xl:inline">
          <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">&lt;</kbd>
          <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] ml-0.5">&gt;</kbd> resize R
        </span>
        {isTeamMode && teams && teams.length > 1 ? (
          <span className="hidden sm:inline">
            <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">{"{"}</kbd>
            <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] ml-0.5">{"}"}</kbd> cycle team
          </span>
        ) : (
          <>
            <span className="hidden 2xl:inline">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">w</kbd> watchlist
            </span>
            <span className="hidden 2xl:inline">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">c</kbd> compare
            </span>
            <span className="hidden 2xl:inline">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">1</kbd>-
              <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">4</kbd> window
            </span>
            <span className="hidden 2xl:inline">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">F1</kbd>-
              <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">F4</kbd> layouts
            </span>
          </>
        )}
      </div>

      {/* Center section - Status indicators / Team carousel */}
      <div className="flex items-center gap-2">
        {isTeamMode && focusedTeam ? (
          // Team carousel
          <div className="flex items-center gap-1.5">
            {prevTeam && (
              <span className="text-muted-foreground/40 truncate max-w-[80px]">
                {prevTeam.league_info.team_name}
              </span>
            )}
            {prevTeam && <span className="text-muted-foreground/30">·</span>}
            <span className="text-primary font-medium">
              {focusedTeam.league_info.team_name}
            </span>
            {nextTeam && <span className="text-muted-foreground/30">·</span>}
            {nextTeam && (
              <span className="text-muted-foreground/40 truncate max-w-[80px]">
                {nextTeam.league_info.team_name}
              </span>
            )}
          </div>
        ) : focusedPlayerId ? (
          <span className="text-primary">
            Player #{focusedPlayerId}
          </span>
        ) : (
          <span className="text-muted-foreground">Overview</span>
        )}
        {comparisonPlayerIds.length > 0 && (
          <span>
            Comparing: {comparisonPlayerIds.length}/4
          </span>
        )}
      </div>

      {/* Right section - Stats */}
      <div className="flex items-center gap-3">
        <span className="hidden md:inline">
          Layout: <span className="text-foreground capitalize">{layout.preset}</span>
        </span>
        <span className="hidden sm:inline">
          Window: <span className="text-foreground">{statWindow.toUpperCase()}</span>
        </span>
        <span className="hidden lg:inline">
          Watchlist: <span className="text-foreground">{watchlist.length}</span>
        </span>
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              layout.leftPanelCollapsed || layout.rightPanelCollapsed
                ? "bg-yellow-500"
                : "bg-green-500"
            )}
          />
          <span className="hidden sm:inline">
            {layout.leftPanelCollapsed && layout.rightPanelCollapsed
              ? "Focused"
              : layout.leftPanelCollapsed || layout.rightPanelCollapsed
              ? "Compact"
              : "Full"}
          </span>
        </span>
      </div>
    </div>
  );
}
