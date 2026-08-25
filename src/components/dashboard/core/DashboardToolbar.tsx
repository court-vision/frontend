"use client";

import { LayoutGrid, RotateCcw, Plus, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { cn } from "@/lib/utils";
import type { LayoutTemplate } from "@/types/dashboard";

interface DashboardToolbarProps {
  teamKey: string;
  /** Template used by Reset; follows the selected team's scoring format. */
  template: LayoutTemplate;
  onOpenCatalog: () => void;
}

export function DashboardToolbar({
  teamKey,
  template,
  onOpenCatalog,
}: DashboardToolbarProps) {
  const { isEditMode, toggleEditMode, resetLayout } = useDashboardStore();

  return (
    <div
      className={cn(
        "flex items-center justify-between h-9 px-4 border-b border-border/40 bg-muted/10 shrink-0",
        "text-xs text-muted-foreground",
        isEditMode && "border-primary/30 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="font-mono font-medium">Dashboard</span>
        {isEditMode && (
          <span className="text-[11px] font-mono text-primary animate-pulse">
            EDIT MODE
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {isEditMode && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] gap-1"
              onClick={onOpenCatalog}
            >
              <Plus className="h-3 w-3" />
              Add Widget
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-muted-foreground gap-1"
              onClick={() => resetLayout(teamKey, template)}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </>
        )}
        <Button
          variant={isEditMode ? "secondary" : "ghost"}
          size="sm"
          className="h-6 text-[11px] gap-1"
          onClick={toggleEditMode}
        >
          {isEditMode ? (
            <>
              <Lock className="h-3 w-3" />
              Done
            </>
          ) : (
            <>
              <Unlock className="h-3 w-3" />
              Edit
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
