"use client";

import { Link2, Pause, Play, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { chipStatus, type ChipTone } from "@/lib/espn-draft/sync-state";
import type { EspnDraftSync } from "@/hooks/useEspnDraftSync";

/** Status-dot colour per tone (shares the app's connectivity palette). */
const DOT_CLASS: Record<ChipTone, string> = {
  ok: "bg-signal-live",
  warn: "bg-status-projected",
  error: "bg-status-loss",
  muted: "bg-signal-stale",
};

/**
 * The live-ESPN-sync status pill for the draft room header: a coloured dot, a
 * status line (with its detail underneath when something needs attention),
 * Link/Ignore for an ESPN room an unlinked session has seen, and Pause/Resume
 * + Resync controls. Renders nothing when the feature is switched off (no
 * extension id) or before the room is enabled, so the room looks exactly as it
 * did without sync.
 */
export function DraftSyncChip({ sync, onLink }: { sync: EspnDraftSync; onLink?: () => void }) {
  if (!sync.configured || sync.state.connection === "unconfigured") return null;

  const { tone, label, detail } = chipStatus(sync.state, sync.paused);
  const attention = tone === "warn" || tone === "error";
  const unbound = sync.state.unbound;
  // Pausing is only meaningful once a room is live; connection problems and the
  // "Chrome only" state have nothing to pause.
  const canPause =
    sync.state.connection === "connected" && sync.state.room !== null && sync.state.mismatch === null;

  return (
    <div
      className="flex items-center gap-1.5 rounded border border-border/60 bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground"
      title={detail ?? undefined}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASS[tone], tone === "ok" && "animate-pulse")} />
      <span className="flex min-w-0 max-w-[44ch] flex-col leading-tight">
        <span className="truncate text-foreground/80">{label}</span>
        {attention && detail && <span className="truncate text-[9px] text-muted-foreground/80">{detail}</span>}
      </span>

      {unbound && onLink && (
        <button
          type="button"
          onClick={onLink}
          className="ml-0.5 inline-flex items-center gap-0.5 rounded bg-primary/15 px-1 py-0.5 uppercase tracking-wide text-primary hover:bg-primary/25"
          title={`Link this room to ESPN room ${unbound.espnLeagueId} — its picks are recorded here from then on`}
        >
          <Link2 className="h-2.5 w-2.5" />
          Link
        </button>
      )}
      {unbound && !unbound.dismissed && (
        <button
          type="button"
          onClick={sync.ignoreRoom}
          className="inline-flex items-center rounded px-1 py-0.5 uppercase tracking-wide hover:bg-muted"
          title="Not this room — keep waiting for another"
        >
          Ignore
        </button>
      )}

      {canPause && (
        <button
          type="button"
          onClick={() => (sync.paused ? sync.resume() : sync.setPaused(true))}
          className="ml-0.5 inline-flex items-center gap-0.5 rounded px-1 py-0.5 uppercase tracking-wide hover:bg-primary/15 hover:text-primary"
          title={sync.paused ? "Resume — replays events since you paused" : "Pause auto-recording"}
        >
          {sync.paused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
          {sync.paused ? "Resume" : "Pause"}
        </button>
      )}

      <button
        type="button"
        onClick={sync.reconnect}
        className="inline-flex items-center rounded px-1 py-0.5 hover:bg-primary/15 hover:text-primary"
        title="Resync — reconnect and reconcile with the ESPN room"
      >
        <RefreshCw className="h-2.5 w-2.5" />
        <span className="sr-only">Resync</span>
      </button>
    </div>
  );
}
