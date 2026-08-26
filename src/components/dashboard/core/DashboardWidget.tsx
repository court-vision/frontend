"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, GripVertical, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWidgetDefinition } from "./DashboardWidgetRegistry";
import { useDashboardStore } from "@/stores/useDashboardStore";

interface DashboardWidgetProps {
  instanceId: string;
  definitionId: string;
  teamKey: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Phone stack mode (set together with `onToggleCollapsed`): the header is a
   * collapse toggle instead of a drag handle, there is no remove button, and
   * the content is unmounted while collapsed.
   */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Fixed content height in px (stack mode); in the grid the card sizes it. */
  contentHeight?: number;
}

export function DashboardWidget({
  instanceId,
  definitionId,
  teamKey,
  children,
  className,
  collapsed = false,
  onToggleCollapsed,
  contentHeight,
}: DashboardWidgetProps) {
  const { isEditMode, removeWidget } = useDashboardStore();
  const def = getWidgetDefinition(definitionId);
  const Icon = def?.icon;
  const collapsible = onToggleCollapsed !== undefined;
  const editing = isEditMode && !collapsible;

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden h-full",
        "border-border/50 bg-card/80 backdrop-blur-sm",
        editing && "ring-1 ring-primary/30",
        className
      )}
    >
      {collapsible ? (
        /* Phone stack — tap the header to collapse/expand */
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
          className={cn(
            "flex items-center justify-between w-full h-10 px-3 bg-muted/20 shrink-0 select-none text-left",
            !collapsed && "border-b border-border/40"
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            {Icon && (
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-medium text-muted-foreground truncate">
              {def?.name}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-150",
              collapsed && "-rotate-90"
            )}
          />
        </button>
      ) : (
        /* Toolbar — drag handle class for react-grid-layout */
        <div
          className={cn(
            "flex items-center justify-between h-8 px-2 border-b border-border/40 bg-muted/20 shrink-0 select-none",
            editing && "widget-drag-handle cursor-grab active:cursor-grabbing"
          )}
        >
          <div className="flex items-center gap-1.5">
            {editing && (
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-xs font-medium text-muted-foreground truncate">
              {def?.name}
            </span>
          </div>
          {editing && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                removeWidget(teamKey, instanceId);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
      {/* Content — unmounted while collapsed; TanStack's cache keeps the data */}
      {!collapsed && (
        <div
          className={cn(
            "overflow-auto min-h-0",
            contentHeight === undefined ? "flex-1" : "shrink-0"
          )}
          style={
            contentHeight === undefined ? undefined : { height: contentHeight }
          }
        >
          {children}
        </div>
      )}
    </Card>
  );
}
