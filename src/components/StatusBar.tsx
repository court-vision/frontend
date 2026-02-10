"use client";

import { useEffect, useState } from "react";
import { useCommandPalette } from "@/providers/CommandPaletteProvider";

const tips = [
  "Press ⌘K to open commands",
  "Press / to search rankings",
  "Press ? for all shortcuts",
  "Use ⌥1-8 to switch pages",
  "Press ⌘G for lineup gen",
];

export function StatusBar() {
  const { open: openCommandPalette } = useCommandPalette();
  const [lastSync, setLastSync] = useState<string>("just now");
  const [clock, setClock] = useState<string>("");
  const [tipIndex, setTipIndex] = useState(0);

  // Update clock every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Rotate tips
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update sync time
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
    <div className="h-6 border-t border-border bg-card/40 px-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground shrink-0">
      {/* Left: Tip ticker */}
      <div className="flex items-center gap-2 hidden sm:flex">
        <span className="text-muted-foreground/30">tip</span>
        <span className="text-muted-foreground/50">{tips[tipIndex]}</span>
      </div>

      {/* Right: Status indicators */}
      <div className="flex items-center gap-3 ml-auto">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-live animate-beacon" />
          <span className="hidden sm:inline text-muted-foreground/40">Connected</span>
        </span>
        <span className="text-muted-foreground/30 hidden sm:inline">Sync: {lastSync}</span>
        <button
          onClick={openCommandPalette}
          className="hover:text-foreground transition-colors text-muted-foreground/40"
        >
          ⌘K
        </button>
        <span className="text-muted-foreground/25">{clock}</span>
      </div>
    </div>
  );
}
