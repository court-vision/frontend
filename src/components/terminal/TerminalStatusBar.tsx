"use client";

import { useTerminalStore } from "@/stores/useTerminalStore";
import { cn } from "@/lib/utils";

interface TerminalStatusBarProps {
  className?: string;
}

export function TerminalStatusBar({ className }: TerminalStatusBarProps) {
  const { layout, focusedPlayerId, comparisonPlayerIds, watchlist, statWindow } =
    useTerminalStore();

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
      </div>

      {/* Center section - Status indicators */}
      <div className="flex items-center gap-3">
        {focusedPlayerId && (
          <span className="text-primary">
            Player #{focusedPlayerId}
          </span>
        )}
        {comparisonPlayerIds.length > 0 && (
          <span>
            Comparing: {comparisonPlayerIds.length}/4
          </span>
        )}
      </div>

      {/* Right section - Stats */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline">
          Window: <span className="text-foreground">{statWindow.toUpperCase()}</span>
        </span>
        <span className="hidden sm:inline">
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
