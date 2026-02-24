"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useGamesOnDateQuery, getTodayDate } from "@/hooks/useGames";
import { Skeleton } from "@/components/ui/skeleton";
import type { GameInfo } from "@/types/games";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatGameClock(clock: string | null): string {
  if (!clock) return "";
  const match = clock.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return "";
  const mins = parseInt(match[1]);
  const secs = Math.floor(parseFloat(match[2]));
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTipoff(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "P" : "A";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

function parseTimeToMinutes(time: string | null | undefined): number {
  if (!time) return Infinity;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function sortGamesByTime(games: GameInfo[]): GameInfo[] {
  return [...games].sort(
    (a, b) => parseTimeToMinutes(a.start_time_et) - parseTimeToMinutes(b.start_time_et)
  );
}

// ── Separators ────────────────────────────────────────────────────────────────

/** Small dot between individual games within one pass */
function ChipDivider() {
  return (
    <span className="mx-3.5 text-border/50 text-[10px] font-mono select-none" aria-hidden="true">
      ·
    </span>
  );
}

/** Sparse dashed rule between repetition groups */
function GroupDivider() {
  return (
    <span className="inline-flex h-full items-center mx-6 select-none" aria-hidden="true">
      <span
        className="self-stretch w-px"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, hsl(var(--muted-foreground) / 0.35) 0px, hsl(var(--muted-foreground) / 0.35) 2px, transparent 2px, transparent 10px)",
        }}
      />
    </span>
  );
}

// ── GameChip ─────────────────────────────────────────────────────────────────

interface GameChipProps {
  game: GameInfo;
}

function GameChip({ game }: GameChipProps) {
  const isLive = game.status === "in_progress";
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled";

  const clockStr = formatGameClock(game.game_clock);
  const tipoffStr = formatTipoff(game.start_time_et);

  const awayWon =
    isFinal &&
    game.away_score !== null &&
    game.home_score !== null &&
    game.away_score > game.home_score;
  const homeWon =
    isFinal &&
    game.away_score !== null &&
    game.home_score !== null &&
    game.home_score > game.away_score;

  return (
    <span className="inline-flex items-center whitespace-nowrap select-none">
      {/* Status prefix */}
      {isLive && (
        <span className="inline-flex items-center gap-1 mr-2">
          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-mono font-semibold text-emerald-500 uppercase tracking-wider">
            Q{game.period ?? "?"}
          </span>
          {clockStr && (
            <span className="text-[9px] font-mono text-emerald-500/60">{clockStr}</span>
          )}
        </span>
      )}
      {isFinal && (
        <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider mr-2">
          FINAL
        </span>
      )}
      {isScheduled && tipoffStr && (
        <span className="text-[9px] font-mono text-muted-foreground/50 mr-2">
          {tipoffStr}
        </span>
      )}

      {/* Teams + scores */}
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn(
            "text-[11px] font-mono font-medium tabular-nums",
            isLive && "text-emerald-400",
            isFinal && (awayWon ? "text-foreground" : "text-muted-foreground/50"),
            isScheduled && "text-muted-foreground/70"
          )}
        >
          {game.away_team}
        </span>

        {(isLive || isFinal) && game.away_score !== null ? (
          <>
            <span
              className={cn(
                "text-[12px] font-mono font-bold tabular-nums",
                isLive && "text-emerald-300",
                isFinal && (awayWon ? "text-foreground" : "text-muted-foreground/60")
              )}
            >
              {game.away_score}
            </span>
            <span className="text-[9px] text-muted-foreground/30 font-mono">–</span>
            <span
              className={cn(
                "text-[12px] font-mono font-bold tabular-nums",
                isLive && "text-emerald-300",
                isFinal && (homeWon ? "text-foreground" : "text-muted-foreground/60")
              )}
            >
              {game.home_score}
            </span>
          </>
        ) : (
          <span className="text-[10px] font-mono text-muted-foreground/30">@</span>
        )}

        <span
          className={cn(
            "text-[11px] font-mono font-medium tabular-nums",
            isLive && "text-emerald-400",
            isFinal && (homeWon ? "text-foreground" : "text-muted-foreground/50"),
            isScheduled && "text-muted-foreground/70"
          )}
        >
          {game.home_team}
        </span>
      </span>
    </span>
  );
}

function TickerPass({ games, passId }: { games: GameInfo[]; passId: string }) {
  return (
    <>
      {games.map((game, gameIdx) => (
        <React.Fragment key={`${passId}-${game.game_id}-${gameIdx}`}>
          <GameChip game={game} />
          {gameIdx < games.length - 1 && <ChipDivider />}
        </React.Fragment>
      ))}
      <GroupDivider />
    </>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TickerSkeleton() {
  return (
    <div className="relative h-9 flex items-center overflow-hidden bg-card/40 border-y border-border/40 px-3 gap-5">
      {[80, 95, 70, 95, 80, 90].map((w, i) => (
        <Skeleton key={i} className="h-2 rounded-full shrink-0" style={{ width: w }} />
      ))}
    </div>
  );
}

// ── GameScoreTicker ───────────────────────────────────────────────────────────

export function GameScoreTicker() {
  const { data, isLoading, error } = useGamesOnDateQuery(getTodayDate());
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const measureRef = React.useRef<HTMLDivElement | null>(null);
  const [groupsPerHalf, setGroupsPerHalf] = React.useState(1);
  const [isPaused, setIsPaused] = React.useState(false);
  const sorted = data ? sortGamesByTime(data.games) : [];

  React.useEffect(() => {
    if (!data || sorted.length === 0) return;

    const recalc = () => {
      const containerWidth = containerRef.current?.clientWidth ?? 0;
      const passWidth = measureRef.current?.scrollWidth ?? 0;

      if (!containerWidth || !passWidth) return;

      // Each animation cycle moves exactly one half-track. Keep that half wider
      // than the viewport (plus one extra pass buffer) so the viewport never
      // outruns the rendered content and exposes a blank gap.
      const nextGroupsPerHalf = Math.max(1, Math.ceil(containerWidth / passWidth) + 1);
      setGroupsPerHalf((prev) => (prev === nextGroupsPerHalf ? prev : nextGroupsPerHalf));
    };

    recalc();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", recalc);
      return () => window.removeEventListener("resize", recalc);
    }

    const observer = new ResizeObserver(recalc);
    if (containerRef.current) observer.observe(containerRef.current);
    if (measureRef.current) observer.observe(measureRef.current);

    return () => observer.disconnect();
  }, [data, sorted.length]);

  if (isLoading) return <TickerSkeleton />;
  if (error || !data || sorted.length === 0) return null;

  const repeatCount = groupsPerHalf * 2;

  const baseDurationSeconds = Math.max(sorted.length * 5, 24);
  const legacyGroupsPerHalf = sorted.length <= 3 ? 2 : 1;
  const oldSpeedDurationSeconds =
    baseDurationSeconds * (groupsPerHalf / legacyGroupsPerHalf);
  const slowerNoGapDurationSeconds = baseDurationSeconds * groupsPerHalf;

  // Blend between the original ticker pace and the slower no-gap dynamic pace
  // for a middle-ground speed, while keeping the seamless loop behavior.
  const duration = `${(oldSpeedDurationSeconds + slowerNoGapDurationSeconds) / 2}s`;

  return (
    <div
      role="marquee"
      aria-label="Today's NBA game scores"
      ref={containerRef}
      className="relative h-9 flex items-center overflow-hidden bg-card/40 border-y border-border/40 group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Fixed "TODAY · nG" label overlaid on the left */}
      <div className="absolute left-0 z-10 flex items-center gap-2 pl-3 h-full pointer-events-none">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/85 whitespace-nowrap">
          Today
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/85">
          {sorted.length}G
        </span>
        <div className="w-px h-3 bg-border/50 ml-0.5" />
      </div>

      {/* Left solid block — hard cutoff, content disappears behind the label */}
      <div className="absolute inset-y-0 left-0 w-20 z-[5] bg-background pointer-events-none" />
      {/* Right gradient */}
      <div className="absolute inset-y-0 right-0 w-14 z-[5] bg-gradient-to-l from-background to-transparent pointer-events-none" />

      {/*
        Scroll track.
        `w-max` + `shrink-0` are critical: they make the div exactly as wide
        as its natural content so translateX(-50%) = exactly one group-set's
        width, producing a seamless loop with zero blank gap.
        `ticker-marquee` (globals.css) uses clean translateX(-50%) with no
        offset correction — avoiding the seam drift in the built-in scroll keyframe.
      */}
      <div
        className="flex h-full items-center w-max shrink-0"
        style={{
          animationName: "ticker-marquee",
          animationDuration: duration,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationPlayState: isPaused ? "paused" : "running",
        }}
        aria-hidden="true"
      >
        {Array.from({ length: repeatCount }, (_, groupIdx) => (
          <TickerPass key={groupIdx} games={sorted} passId={`track-${groupIdx}`} />
        ))}
      </div>

      {/* Hidden pass measurer used to size the loop correctly across viewports */}
      <div
        ref={measureRef}
        className="absolute invisible pointer-events-none flex items-center w-max"
        aria-hidden="true"
      >
        <TickerPass games={sorted} passId="measure" />
      </div>
    </div>
  );
}
