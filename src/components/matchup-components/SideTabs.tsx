"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SideTabsProps {
  /** Label for the second tab (the opponent's team name, truncated). */
  opponentName: string;
  you: ReactNode;
  opponent: ReactNode;
}

// Both panels stay mounted (`forceMount`), so the roster tables are never
// re-created when switching and desktop renders both regardless of tab state.
// `flex` (not `block`) so each card still stretches to the grid row height.
const PANEL_CLASS =
  "mt-0 flex flex-col data-[state=inactive]:hidden lg:data-[state=inactive]:flex";

/**
 * Your team and the opponent side by side from `lg`; below that a You /
 * Opponent tab switcher over the same cards (a phone can't fit two roster
 * tables, and stacking them puts the opponent a full screen down).
 */
export function SideTabs({ opponentName, you, opponent }: SideTabsProps) {
  return (
    <Tabs defaultValue="you">
      <TabsList className="lg:hidden grid h-10 w-full grid-cols-2 mb-3">
        <TabsTrigger value="you" className="h-full min-w-0">
          You
        </TabsTrigger>
        <TabsTrigger value="opponent" className="h-full min-w-0">
          <span className="truncate">{opponentName}</span>
        </TabsTrigger>
      </TabsList>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TabsContent value="you" forceMount tabIndex={-1} className={PANEL_CLASS}>
          {you}
        </TabsContent>
        <TabsContent value="opponent" forceMount tabIndex={-1} className={PANEL_CLASS}>
          {opponent}
        </TabsContent>
      </div>
    </Tabs>
  );
}
