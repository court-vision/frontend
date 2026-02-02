"use client";

import { useState, type ReactNode, useRef, useEffect } from "react";
import { RefreshCw, Maximize2, Minimize2, X, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PanelToolbar } from "./PanelToolbar";
import { getPanelDefinition } from "./PanelRegistry";
import type { PanelDefinition } from "@/types/terminal";

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface PanelContainerProps {
  definitionId: string;
  children: ReactNode;
  onClose?: () => void;
  onRefresh?: () => void;
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
  onRefresh,
  showToolbar = true,
  showClose = true,
  showMaximize = true,
  className,
  contentClassName,
}: PanelContainerProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const definition = getPanelDefinition(definitionId);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && contextMenu) {
        setContextMenu(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

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
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRefresh = () => {
    onRefresh?.();
    setContextMenu(null);
    // Trigger a visual feedback
    if (containerRef.current) {
      containerRef.current.classList.add("animate-pulse");
      setTimeout(() => {
        containerRef.current?.classList.remove("animate-pulse");
      }, 300);
    }
  };

  return (
    <>
      <Card
        ref={containerRef}
        className={cn(
          "flex flex-col overflow-hidden",
          "border-border/50 bg-card/50 backdrop-blur-sm",
          isMaximized && "fixed inset-4 z-50",
          className
        )}
        onContextMenu={handleContextMenu}
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[100] min-w-[160px] py-1 bg-popover border border-border rounded-md shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1">
            {definition.name}
          </div>

          <button
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>

          {showMaximize && (
            <button
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
              onClick={handleMaximize}
            >
              {isMaximized ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>Restore</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Maximize</span>
                </>
              )}
            </button>
          )}

          <div className="h-px bg-border/50 my-1" />

          <button
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left text-muted-foreground"
            onClick={() => {
              navigator.clipboard.writeText(definition.id);
              setContextMenu(null);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copy panel ID</span>
          </button>

          {showClose && onClose && (
            <>
              <div className="h-px bg-border/50 my-1" />
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
                onClick={() => {
                  onClose();
                  setContextMenu(null);
                }}
              >
                <X className="h-3.5 w-3.5" />
                <span>Close</span>
              </button>
            </>
          )}
        </div>
      )}
    </>
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
