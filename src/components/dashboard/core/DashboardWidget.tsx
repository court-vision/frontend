"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWidgetDefinition } from "./DashboardWidgetRegistry";
import { useDashboardStore } from "@/stores/useDashboardStore";

interface DashboardWidgetProps {
  instanceId: string;
  definitionId: string;
  teamKey: string;
  children: React.ReactNode;
  className?: string;
}

export function DashboardWidget({
  instanceId,
  definitionId,
  teamKey,
  children,
  className,
}: DashboardWidgetProps) {
  const { isEditMode, removeWidget } = useDashboardStore();
  const def = getWidgetDefinition(definitionId);
  const Icon = def?.icon;

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden h-full",
        "border-border/50 bg-card/80 backdrop-blur-sm",
        isEditMode && "ring-1 ring-primary/30",
        className
      )}
    >
      {/* Toolbar — drag handle class for react-grid-layout */}
      <div
        className={cn(
          "flex items-center justify-between h-8 px-2 border-b border-border/40 bg-muted/20 shrink-0 select-none",
          isEditMode && "widget-drag-handle cursor-grab active:cursor-grabbing"
        )}
      >
        <div className="flex items-center gap-1.5">
          {isEditMode && (
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-xs font-medium text-muted-foreground truncate">
            {def?.name}
          </span>
        </div>
        {isEditMode && (
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
      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">{children}</div>
    </Card>
  );
}
