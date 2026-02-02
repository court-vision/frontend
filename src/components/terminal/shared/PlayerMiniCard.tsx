"use client";

import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface PlayerMiniCardProps {
  name: string;
  team: string;
  position?: string;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
}

export function PlayerMiniCard({
  name,
  team,
  position,
  onClick,
  isSelected = false,
  className,
}: PlayerMiniCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 p-2 rounded text-left w-full",
        "hover:bg-muted/50 transition-colors",
        isSelected && "bg-primary/10 border border-primary/30",
        !isSelected && "bg-transparent",
        className
      )}
    >
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{name}</div>
        <div className="text-xs text-muted-foreground font-mono">
          {team}
          {position && ` · ${position}`}
        </div>
      </div>
    </button>
  );
}

interface PlayerHeaderProps {
  name: string;
  team: string;
  gamesPlayed?: number;
  className?: string;
}

export function PlayerHeader({
  name,
  team,
  gamesPlayed,
  className,
}: PlayerHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
        <User className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-base truncate">{name}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>{team}</span>
          {gamesPlayed !== undefined && (
            <>
              <span className="text-border">·</span>
              <span>{gamesPlayed} GP</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
