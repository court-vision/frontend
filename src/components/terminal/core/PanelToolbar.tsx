"use client";

import { Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PanelDefinition } from "@/types/terminal";

interface PanelToolbarProps {
  definition: PanelDefinition;
  isMaximized?: boolean;
  onMaximize?: () => void;
  onClose?: () => void;
  showClose?: boolean;
  showMaximize?: boolean;
  className?: string;
}

export function PanelToolbar({
  definition,
  isMaximized = false,
  onMaximize,
  onClose,
  showClose = true,
  showMaximize = true,
  className,
}: PanelToolbarProps) {
  const Icon = definition.icon;

  return (
    <div
      className={cn(
        "flex items-center justify-between h-8 px-2 border-b border-border/50 bg-muted/30",
        "select-none",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {definition.name}
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        {showMaximize && onMaximize && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            onClick={onMaximize}
          >
            {isMaximized ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
        )}
        {showClose && onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-destructive"
            onClick={onClose}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
