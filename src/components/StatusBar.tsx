"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { onlineManager, useIsFetching } from "@tanstack/react-query";
import { useCommandPalette } from "@/providers/CommandPaletteProvider";
import { useApiHealthQuery } from "@/hooks/useApiHealth";
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

type Connectivity = "ok" | "degraded" | "offline" | "unknown";

const DOT_CLASS: Record<Connectivity, string> = {
  ok: "bg-signal-live",
  degraded: "bg-status-projected",
  offline: "bg-status-loss",
  unknown: "bg-signal-stale",
};

const LABEL_CLASS: Record<Connectivity, string> = {
  ok: "text-muted-foreground/40",
  degraded: "text-status-projected/80",
  offline: "text-status-loss/80",
  unknown: "text-muted-foreground/40",
};

/** The browser's connectivity as TanStack sees it (drives its refetch-on-reconnect). */
function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true
  );
}

export function StatusBar() {
  const { open: openCommandPalette } = useCommandPalette();
  const [clock, setClock] = useState<string>("");
  const [now, setNow] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const health = useApiHealthQuery();
  const isOnline = useIsOnline();
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

  // "degraded" is reserved for a real 503 / `status: "degraded"` body; a 404
  // (endpoint not deployed yet), network failure or timeout is "unknown".
  const connectivity: Connectivity = !isOnline
    ? "offline"
    : health.isError || !health.data
      ? "unknown"
      : health.data.status;

  const latency = health.data?.dbLatencyMs;
  const label: Record<Connectivity, string> = {
    ok: latency !== null && latency !== undefined ? `API ok · ${latency} ms` : "API ok",
    degraded: "API degraded",
    offline: "offline",
    unknown: "API status unknown",
  };
  const detail = [
    health.data?.version ? `version ${health.data.version}` : null,
    health.data?.environment ?? null,
    "click to re-check",
  ]
    .filter(Boolean)
    .join(" · ");
  const syncLabel = health.dataUpdatedAt ? formatRelativeTime(health.dataUpdatedAt, now) : "—";

  return (
    <div className="h-7 border-t border-border bg-card/80 px-3 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
      {/* Left: Tip ticker */}
      <div className="flex items-center gap-2 hidden sm:flex">
        <span className="text-muted-foreground/30">tip</span>
        <span className="text-muted-foreground/50">{tips[tipIndex]}</span>
      </div>

      {/* Right: Status indicators */}
      <div className="flex items-center gap-3 ml-auto">
        <button
          type="button"
          onClick={() => health.refetch()}
          title={detail}
          aria-label={`API status: ${label[connectivity]}`}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              DOT_CLASS[connectivity],
              isFetching && "animate-beacon"
            )}
          />
          <span className={cn("hidden sm:inline", LABEL_CLASS[connectivity])}>
            {label[connectivity]}
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
