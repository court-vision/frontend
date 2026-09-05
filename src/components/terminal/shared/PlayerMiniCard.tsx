"use client";

import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "./PlayerHeadshot";

interface PlayerMiniCardProps {
  /** NBA player ID (`nba.players.id`); omit to show the placeholder. */
  playerId?: number | null;
  name: string;
  team: string;
  position?: string;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
}

export function PlayerMiniCard({
  playerId,
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
      <PlayerHeadshot playerId={playerId} name={name} size="sm" />
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
  /** NBA player ID (`nba.players.id`); omit to show the placeholder. */
  playerId?: number | null;
  name: string;
  team: string;
  gamesPlayed?: number;
  className?: string;
}

export function PlayerHeader({
  playerId,
  name,
  team,
  gamesPlayed,
  className,
}: PlayerHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <PlayerHeadshot playerId={playerId} name={name} size="md" />
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
