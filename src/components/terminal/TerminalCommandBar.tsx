"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, RefreshCw, Settings, ChevronRight, Terminal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useRankingsQuery } from "@/hooks/useRankings";
import type { StatWindow, LayoutPreset } from "@/types/terminal";

interface CommandBarProps {
  className?: string;
}

interface CommandSuggestion {
  command: string;
  description: string;
  example?: string;
}

const COMMANDS: CommandSuggestion[] = [
  { command: ":window", description: "Set stat window", example: ":window l10" },
  { command: ":layout", description: "Switch layout preset", example: ":layout chart" },
  { command: ":compare", description: "Compare players", example: ":compare curry lebron" },
  { command: ":clear", description: "Clear comparison", example: ":clear" },
  { command: ":focus", description: "Focus a player", example: ":focus curry" },
];

export function TerminalCommandBar({ className }: CommandBarProps) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    setFocusedPlayer,
    addToCommandHistory,
    setStatWindow,
    setLayoutPreset,
    addToComparison,
    clearComparison,
  } = useTerminalStore();
  const { data: rankings, refetch, isFetching } = useRankingsQuery();

  // Check if input is a command
  const isCommand = inputValue.startsWith(":");

  // Filter command suggestions
  const commandSuggestions = useMemo(() => {
    if (!isCommand || inputValue.length < 2) return [];
    const search = inputValue.toLowerCase();
    return COMMANDS.filter((cmd) => cmd.command.startsWith(search));
  }, [inputValue, isCommand]);

  // Filter players based on search input
  const searchResults = useMemo(() => {
    if (isCommand || inputValue.length < 2 || !rankings) return [];
    return rankings
      .filter((player) =>
        player.player_name.toLowerCase().includes(inputValue.toLowerCase())
      )
      .slice(0, 8);
  }, [inputValue, rankings, isCommand]);

  // Combined results for display
  const results = isCommand ? commandSuggestions : searchResults;

  // Execute a command
  const executeCommand = useCallback(
    (commandString: string) => {
      const parts = commandString.slice(1).split(/\s+/); // Remove ":" and split
      const command = parts[0]?.toLowerCase();
      const args = parts.slice(1);

      switch (command) {
        case "window": {
          const windowArg = args[0]?.toLowerCase();
          const validWindows: StatWindow[] = ["season", "l5", "l10", "l20"];
          if (validWindows.includes(windowArg as StatWindow)) {
            setStatWindow(windowArg as StatWindow);
            setCommandFeedback(`Window set to ${windowArg.toUpperCase()}`);
          } else {
            setCommandFeedback(`Invalid window. Use: season, l5, l10, l20`);
          }
          break;
        }
        case "layout": {
          const layoutArg = args[0]?.toLowerCase();
          const validLayouts: LayoutPreset[] = ["default", "chart", "comparison", "data"];
          if (validLayouts.includes(layoutArg as LayoutPreset)) {
            setLayoutPreset(layoutArg as LayoutPreset);
            setCommandFeedback(`Layout set to ${layoutArg}`);
          } else {
            setCommandFeedback(`Invalid layout. Use: default, chart, comparison, data`);
          }
          break;
        }
        case "compare": {
          if (args.length === 0) {
            setCommandFeedback("Usage: :compare <player name>");
            break;
          }
          const searchName = args.join(" ").toLowerCase();
          const player = rankings?.find((p) =>
            p.player_name.toLowerCase().includes(searchName)
          );
          if (player) {
            addToComparison(player.id);
            setCommandFeedback(`Added ${player.player_name} to comparison`);
          } else {
            setCommandFeedback(`Player not found: ${args.join(" ")}`);
          }
          break;
        }
        case "focus": {
          if (args.length === 0) {
            setCommandFeedback("Usage: :focus <player name>");
            break;
          }
          const searchName = args.join(" ").toLowerCase();
          const player = rankings?.find((p) =>
            p.player_name.toLowerCase().includes(searchName)
          );
          if (player) {
            setFocusedPlayer(player.id);
            setCommandFeedback(`Focused on ${player.player_name}`);
          } else {
            setCommandFeedback(`Player not found: ${args.join(" ")}`);
          }
          break;
        }
        case "clear": {
          clearComparison();
          setCommandFeedback("Comparison cleared");
          break;
        }
        default:
          setCommandFeedback(`Unknown command: ${command}`);
      }

      addToCommandHistory(commandString);

      // Clear feedback after delay
      setTimeout(() => setCommandFeedback(null), 2000);
    },
    [
      rankings,
      setStatWindow,
      setLayoutPreset,
      addToComparison,
      clearComparison,
      setFocusedPlayer,
      addToCommandHistory,
    ]
  );

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
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (isCommand) {
          // Execute command
          if (commandSuggestions.length > 0 && inputValue.split(/\s+/).length === 1) {
            // If just typing command name, autocomplete it
            setInputValue(commandSuggestions[selectedIndex].command + " ");
          } else {
            // Execute the full command
            executeCommand(inputValue);
            setInputValue("");
          }
        } else if (searchResults.length > 0) {
          // Select player
          const selected = searchResults[selectedIndex];
          if (selected) {
            handleSelectPlayer(selected.id, selected.player_name);
          }
        }
      } else if (e.key === "Escape") {
        inputRef.current?.blur();
        setInputValue("");
      } else if (e.key === "Tab" && isCommand && commandSuggestions.length > 0) {
        e.preventDefault();
        setInputValue(commandSuggestions[selectedIndex].command + " ");
      }
    },
    [results, selectedIndex, isCommand, commandSuggestions, searchResults, inputValue, executeCommand]
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
          {isCommand ? (
            <Terminal className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary" />
          ) : (
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          )}
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
              "focus:bg-background focus:border-primary/50",
              isCommand && "text-primary"
            )}
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
            /
          </kbd>
        </div>

        {/* Command Suggestions Dropdown */}
        {isFocused && isCommand && commandSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-popover border border-border rounded-md shadow-lg z-50">
            {commandSuggestions.map((cmd, index) => (
              <button
                key={cmd.command}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left",
                  "hover:bg-muted transition-colors",
                  index === selectedIndex && "bg-muted"
                )}
                onClick={() => setInputValue(cmd.command + " ")}
              >
                <Terminal className="h-3 w-3 text-primary" />
                <span className="font-mono text-primary">{cmd.command}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {cmd.description}
                </span>
                {cmd.example && (
                  <span className="text-[10px] text-muted-foreground/50 ml-auto font-mono">
                    {cmd.example}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Search Results Dropdown */}
        {isFocused && !isCommand && searchResults.length > 0 && (
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

      {/* Command Feedback */}
      {commandFeedback && (
        <div className="text-xs font-mono text-primary animate-in fade-in slide-in-from-left-2 duration-200">
          {commandFeedback}
        </div>
      )}

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
