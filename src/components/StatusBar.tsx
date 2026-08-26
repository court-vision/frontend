"use client";

import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useCommandPalette } from "@/providers/CommandPaletteProvider";
import {
  CONNECTIVITY_DOT_CLASS,
  connectivityLabel,
  useConnectivity,
  type Connectivity,
} from "@/hooks/useApiHealth";
import { ALT_RANGE_LABEL } from "@/lib/navigation";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const tips = [
  "Press ⌘K to open commands",
  "Press / to search rankings",
  "Press ? for all shortcuts",
  `Use ${ALT_RANGE_LABEL} to switch pages`,
  "Press ⌘G for lineup gen",
];

const LABEL_CLASS: Record<Connectivity, string> = {
  ok: "text-muted-foreground/40",
  degraded: "text-status-projected/80",
  offline: "text-status-loss/80",
  unknown: "text-muted-foreground/40",
};

/** Desktop-only (md and up); phones get the tab bar and the header's health dot instead. */
export function StatusBar() {
  const { open: openCommandPalette } = useCommandPalette();
  const [clock, setClock] = useState<string>("");
  const [now, setNow] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const { connectivity, health } = useConnectivity();
  const isFetching = useIsFetching() > 0;

  // Update clock (and the relative "Sync" time) every second
  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current.getTime());
      setClock(
        current.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Rotate tips
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const label = connectivityLabel(connectivity, health.data?.dbLatencyMs);
  const detail = [
    health.data?.version ? `version ${health.data.version}` : null,
    health.data?.environment ?? null,
    "click to re-check",
  ]
    .filter(Boolean)
    .join(" · ");
  const syncLabel = health.dataUpdatedAt ? formatRelativeTime(health.dataUpdatedAt, now) : "—";

  return (
    <div className="hidden md:flex h-7 border-t border-border bg-card/80 px-3 items-center justify-between text-[11px] text-muted-foreground shrink-0">
      {/* Left: Tip ticker */}
      <div className="hidden sm:flex items-center gap-2">
        <span className="text-muted-foreground/30">tip</span>
        <span className="text-muted-foreground/50">{tips[tipIndex]}</span>
      </div>

      {/* Right: Status indicators */}
      <div className="flex items-center gap-3 ml-auto">
        <button
          type="button"
          onClick={() => health.refetch()}
          title={detail}
          aria-label={`API status: ${label}`}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              CONNECTIVITY_DOT_CLASS[connectivity],
              isFetching && "animate-beacon"
            )}
          />
          <span className={cn("hidden sm:inline", LABEL_CLASS[connectivity])}>
            {label}
          </span>
        </button>
        <span className="text-muted-foreground/30 hidden sm:inline">Sync: {syncLabel}</span>
        <button
          onClick={openCommandPalette}
          className="hover:text-foreground transition-colors text-muted-foreground/40"
        >
          ⌘K
        </button>
        <span className="font-mono text-muted-foreground/25">{clock}</span>
      </div>
    </div>
  );
}
