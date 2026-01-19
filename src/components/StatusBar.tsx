"use client";

import { useEffect, useState } from "react";
import { useCommandPalette } from "@/providers/CommandPaletteProvider";

export function StatusBar() {
  const { open: openCommandPalette } = useCommandPalette();
  const [lastSync, setLastSync] = useState<string>("just now");

  // Update "last sync" periodically (simulated)
  useEffect(() => {
    const interval = setInterval(() => {
      setLastSync((prev) => {
        if (prev === "just now") return "1m ago";
        if (prev === "1m ago") return "2m ago";
        if (prev === "2m ago") return "3m ago";
        return prev;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-6 border-t bg-muted/30 px-4 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-status-win animate-pulse" />
          Connected
        </span>
        <span className="hidden sm:inline">Last sync: {lastSync}</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={openCommandPalette}
          className="hover:text-foreground transition-colors"
        >
          ⌘K Commands
        </button>
        <span className="hidden sm:inline text-muted-foreground/70">v1.0.0</span>
      </div>
    </div>
  );
}
