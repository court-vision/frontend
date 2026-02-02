"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PanelToolbar } from "./PanelToolbar";
import { getPanelDefinition } from "./PanelRegistry";
import type { PanelDefinition } from "@/types/terminal";

interface PanelContainerProps {
  definitionId: string;
  children: ReactNode;
  onClose?: () => void;
  showToolbar?: boolean;
  showClose?: boolean;
  showMaximize?: boolean;
  className?: string;
  contentClassName?: string;
}

export function PanelContainer({
  definitionId,
  children,
  onClose,
  showToolbar = true,
  showClose = true,
  showMaximize = true,
  className,
  contentClassName,
}: PanelContainerProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const definition = getPanelDefinition(definitionId);

  if (!definition) {
    return (
      <Card className={cn("flex items-center justify-center", className)}>
        <span className="text-xs text-muted-foreground">
          Unknown panel: {definitionId}
        </span>
      </Card>
    );
  }

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden",
        "border-border/50 bg-card/50 backdrop-blur-sm",
        isMaximized && "fixed inset-4 z-50",
        className
      )}
    >
      {showToolbar && (
        <PanelToolbar
          definition={definition}
          isMaximized={isMaximized}
          onMaximize={showMaximize ? handleMaximize : undefined}
          onClose={showClose ? onClose : undefined}
          showClose={showClose}
          showMaximize={showMaximize}
        />
      )}
      <div
        className={cn(
          "flex-1 overflow-auto",
          contentClassName
        )}
      >
        {children}
      </div>
    </Card>
  );
}

// Placeholder panel content for panels not yet implemented
export function PlaceholderPanel({ definitionId }: { definitionId: string }) {
  const definition = getPanelDefinition(definitionId);

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      {definition && (
        <>
          <definition.icon className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <span className="text-sm font-medium text-muted-foreground">
            {definition.name}
          </span>
          <span className="text-xs text-muted-foreground/70 mt-1">
            {definition.description}
          </span>
        </>
      )}
    </div>
  );
}
