"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "GLOBAL",
    shortcuts: [
      { keys: "⌘K", description: "Command palette" },
      { keys: "⌥1-8", description: "Switch pages" },
      { keys: "?", description: "This overlay" },
      { keys: "⌘G", description: "Lineup generation" },
      { keys: "⌘S", description: "Streamers" },
      { keys: "⌘R", description: "Rankings" },
      { keys: "⌘M", description: "Matchup" },
      { keys: "⌘T", description: "Your teams" },
    ],
  },
  {
    title: "TERMINAL",
    shortcuts: [
      { keys: "/", description: "Focus command bar" },
      { keys: "[ ]", description: "Toggle left/right panels" },
      { keys: ", .", description: "Resize left panel" },
      { keys: "< >", description: "Resize right panel" },
      { keys: "F1-F4", description: "Layout presets" },
      { keys: "W", description: "Add to watchlist" },
      { keys: "C", description: "Add to comparison" },
    ],
  },
  {
    title: "COMMAND PALETTE",
    shortcuts: [
      { keys: "↑ ↓", description: "Navigate results" },
      { keys: "↵", description: "Select command" },
      { keys: "Esc", description: "Close" },
    ],
  },
  {
    title: "TERMINAL COMMANDS",
    shortcuts: [
      { keys: ":window", description: "Change stat window" },
      { keys: ":layout", description: "Switch layout preset" },
      { keys: ":compare", description: "Add player to compare" },
      { keys: ":focus", description: "Focus on player" },
      { keys: ":clear", description: "Clear comparison" },
    ],
  },
];

export function KeyboardShortcutOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        if (e.key === "Escape" && isOpen) {
          setIsOpen(false);
        }
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleToggle();
      }

      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleToggle]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-3xl mx-4 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground tracking-wide">
              Keyboard Shortcuts
            </h2>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              Press ? or Esc to close
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-border hover:bg-muted hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcut grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shortcutGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-md border border-border bg-card/80 p-4 shadow-[inset_0_0_0_1px_hsl(215_15%_10%)]"
            >
              <h3 className="text-[10px] font-semibold tracking-wider text-primary/60 uppercase mb-3">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <kbd className="inline-flex items-center rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-foreground/70 min-w-[40px] justify-center">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
