"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, RefreshCw, Settings, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useRankingsQuery } from "@/hooks/useRankings";

interface CommandBarProps {
  className?: string;
}

export function TerminalCommandBar({ className }: CommandBarProps) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setFocusedPlayer, addToCommandHistory } = useTerminalStore();
  const { data: rankings, refetch, isFetching } = useRankingsQuery();

  // Filter players based on search input
  const searchResults = inputValue.length >= 2 && rankings
    ? rankings
        .filter((player) =>
          player.player_name.toLowerCase().includes(inputValue.toLowerCase())
        )
        .slice(0, 8)
    : [];

  // Focus input on "/" key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle keyboard navigation in search results
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, searchResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && searchResults.length > 0) {
        e.preventDefault();
        const selected = searchResults[selectedIndex];
        if (selected) {
          handleSelectPlayer(selected.id, selected.player_name);
        }
      } else if (e.key === "Escape") {
        inputRef.current?.blur();
        setInputValue("");
      }
    },
    [searchResults, selectedIndex]
  );

  const handleSelectPlayer = (playerId: number, playerName: string) => {
    setFocusedPlayer(playerId);
    addToCommandHistory(playerName);
    setInputValue("");
    setSelectedIndex(0);
    inputRef.current?.blur();
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 h-10 px-2 border-b border-border/50 bg-muted/20",
        className
      )}
    >
      {/* Search/Command Input */}
      <div className="relative flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // Delay to allow click on results
              setTimeout(() => setIsFocused(false), 150);
            }}
            placeholder="Search players or type :command..."
            className={cn(
              "h-7 pl-7 pr-8 text-sm font-mono",
              "bg-background/50 border-border/50",
              "focus:bg-background focus:border-primary/50"
            )}
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
            /
          </kbd>
        </div>

        {/* Search Results Dropdown */}
        {isFocused && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-popover border border-border rounded-md shadow-lg z-50">
            {searchResults.map((player, index) => (
              <button
                key={player.id}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left",
                  "hover:bg-muted transition-colors",
                  index === selectedIndex && "bg-muted"
                )}
                onClick={() => handleSelectPlayer(player.id, player.player_name)}
              >
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{player.player_name}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {player.team}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action Buttons */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleRefresh}
        disabled={isFetching}
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
        />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7">
        <Settings className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
