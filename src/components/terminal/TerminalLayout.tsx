"use client";

import { useEffect, useCallback, useRef } from "react";
import {
  Panel,
  Group,
  Separator,
  type GroupImperativeHandle,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { TerminalCommandBar } from "./TerminalCommandBar";
import { TerminalStatusBar } from "./TerminalStatusBar";
import { PanelContainer } from "./core";
import {
  PlayerFocusPanel,
  PerformanceChartPanel,
  GameLogPanel,
  AdvancedStatsPanel,
  WatchlistPanel,
  TrendingPanel,
  ComparisonPanel,
  SchedulePanel,
} from "./panels";
import type { LayoutPreset } from "@/types/terminal";

const RESIZE_STEP = 5; // Percentage step for keyboard resizing

interface TerminalLayoutProps {
  className?: string;
}

export function TerminalLayout({ className }: TerminalLayoutProps) {
  const {
    layout,
    focusedPlayerId,
    comparisonPlayerIds,
    toggleLeftPanel,
    toggleRightPanel,
    addToWatchlist,
    addToComparison,
    setLayoutPreset,
  } = useTerminalStore();

  const hasComparison = comparisonPlayerIds.length > 0;

  const { leftPanelCollapsed, rightPanelCollapsed, preset } = layout;

  // Ref for imperative panel control (keyboard resizing)
  const groupRef = useRef<GroupImperativeHandle>(null);

  // Keyboard shortcuts for panel toggling and resizing
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Panel toggle shortcuts
      if (e.key === "[" && !e.shiftKey) {
        e.preventDefault();
        toggleLeftPanel();
      } else if (e.key === "]" && !e.shiftKey) {
        e.preventDefault();
        toggleRightPanel();
      }
      // Player action shortcuts
      else if (e.key === "w" && !e.metaKey && !e.ctrlKey && focusedPlayerId) {
        e.preventDefault();
        addToWatchlist(focusedPlayerId);
      } else if (e.key === "c" && !e.metaKey && !e.ctrlKey && focusedPlayerId) {
        e.preventDefault();
        addToComparison(focusedPlayerId);
      }
      // Layout preset shortcuts (F1-F4)
      else if (e.key === "F1") {
        e.preventDefault();
        setLayoutPreset("default");
      } else if (e.key === "F2") {
        e.preventDefault();
        setLayoutPreset("chart");
      } else if (e.key === "F3") {
        e.preventDefault();
        setLayoutPreset("comparison");
      } else if (e.key === "F4") {
        e.preventDefault();
        setLayoutPreset("data");
      }
      // Panel resize via imperative API
      else if ((e.key === "," || e.key === "." || e.key === "<" || e.key === ">") && groupRef.current) {
        e.preventDefault();
        const currentLayout = groupRef.current.getLayout();
        const leftSize = currentLayout["left-panel"] ?? 25;
        const rightSize = currentLayout["right-panel"] ?? 25;
        const centerSize = currentLayout["center-panel"] ?? 50;

        let newLayout = { ...currentLayout };

        if (e.key === "," && !leftPanelCollapsed) {
          // Shrink left panel
          const newLeft = Math.max(15, leftSize - RESIZE_STEP);
          const diff = leftSize - newLeft;
          newLayout = { "left-panel": newLeft, "center-panel": centerSize + diff, "right-panel": rightSize };
        } else if (e.key === "." && !leftPanelCollapsed) {
          // Expand left panel
          const newLeft = Math.min(40, leftSize + RESIZE_STEP);
          const diff = newLeft - leftSize;
          newLayout = { "left-panel": newLeft, "center-panel": centerSize - diff, "right-panel": rightSize };
        } else if (e.key === ">" && !rightPanelCollapsed) {
          // Shrink right panel
          const newRight = Math.max(15, rightSize - RESIZE_STEP);
          const diff = rightSize - newRight;
          newLayout = { "left-panel": leftSize, "center-panel": centerSize + diff, "right-panel": newRight };
        } else if (e.key === "<" && !rightPanelCollapsed) {
          // Expand right panel
          const newRight = Math.min(35, rightSize + RESIZE_STEP);
          const diff = newRight - rightSize;
          newLayout = { "left-panel": leftSize, "center-panel": centerSize - diff, "right-panel": newRight };
        }

        groupRef.current.setLayout(newLayout);
      }
    },
    [toggleLeftPanel, toggleRightPanel, leftPanelCollapsed, rightPanelCollapsed, focusedPlayerId, addToWatchlist, addToComparison, setLayoutPreset]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={cn("flex flex-col h-[calc(100vh-3.5rem)]", className)}>
      {/* Command Bar */}
      <TerminalCommandBar />

      {/* Main Panel Layout */}
      <Group
        orientation="horizontal"
        className="flex-1"
        groupRef={groupRef}
      >
        {/* Left Panel - Player Focus */}
        {!leftPanelCollapsed && (
          <>
            <Panel
              id="left-panel"
              defaultSize="25%"
              minSize="15%"
              maxSize="40%"
              className="flex flex-col gap-2 p-2"
            >
              <PanelContainer
                definitionId="player-focus"
                showClose={false}
                showMaximize={false}
                className="flex-1"
              >
                <PlayerFocusPanel />
              </PanelContainer>
            </Panel>
            <Separator className="w-3 bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize flex items-center justify-center">
              <div className="w-px h-12 bg-border group-hover:bg-primary transition-colors rounded-full" />
            </Separator>
          </>
        )}

        {/* Center Workspace */}
        <Panel id="center-panel" defaultSize="50%" minSize="30%" className="flex flex-col gap-2 p-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 flex-1">
            <PanelContainer
              definitionId="performance-chart"
              showClose={false}
              className="min-h-[200px]"
            >
              <PerformanceChartPanel />
            </PanelContainer>
            {hasComparison ? (
              <PanelContainer
                definitionId="comparison"
                showClose={false}
                className="min-h-[200px]"
              >
                <ComparisonPanel />
              </PanelContainer>
            ) : (
              <PanelContainer
                definitionId="advanced-stats"
                showClose={false}
                className="min-h-[200px]"
              >
                <AdvancedStatsPanel />
              </PanelContainer>
            )}
          </div>
          <PanelContainer
            definitionId="game-log"
            showClose={false}
            className="flex-1 min-h-[200px]"
          >
            <GameLogPanel />
          </PanelContainer>
        </Panel>

        {/* Right Panel - Watchlist & Trending */}
        {!rightPanelCollapsed && (
          <>
            <Separator className="w-3 bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize flex items-center justify-center">
              <div className="w-px h-12 bg-border group-hover:bg-primary transition-colors rounded-full" />
            </Separator>
            <Panel
              id="right-panel"
              defaultSize="25%"
              minSize="15%"
              maxSize="35%"
              className="flex flex-col gap-2 p-2"
            >
              <PanelContainer
                definitionId="watchlist"
                showClose={false}
                showMaximize={false}
                className="flex-1"
              >
                <WatchlistPanel />
              </PanelContainer>
              <PanelContainer
                definitionId="schedule"
                showClose={false}
                showMaximize={false}
                className="flex-1"
              >
                <SchedulePanel />
              </PanelContainer>
              <PanelContainer
                definitionId="trending"
                showClose={false}
                showMaximize={false}
                className="flex-[0.5]"
              >
                <TrendingPanel />
              </PanelContainer>
            </Panel>
          </>
        )}
      </Group>

      {/* Status Bar */}
      <TerminalStatusBar />
    </div>
  );
}
