"use client";

import { Medal, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayoffBracketQuery } from "@/hooks/usePlayoff";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlayoffSeriesData } from "@/types/playoff";

// ─── Series card ─────────────────────────────────────────────────────────────

function BracketCard({ series }: { series: PlayoffSeriesData | null }) {
  if (!series) {
    return (
      <div className="h-full rounded border border-border/30 bg-muted/10 flex flex-col items-center justify-center gap-1">
        <span className="font-mono text-[11px] text-muted-foreground/25">TBD</span>
        <div className="h-px w-6 bg-border/20" />
        <span className="font-mono text-[11px] text-muted-foreground/25">TBD</span>
      </div>
    );
  }

  const {
    top_seed_abbr,
    bottom_seed_abbr,
    top_seed_wins,
    bottom_seed_wins,
    series_complete,
    series_leader_abbr,
  } = series;
  const topLeads = top_seed_wins > bottom_seed_wins;
  const bottomLeads = bottom_seed_wins > top_seed_wins;
  const active = top_seed_wins > 0 || bottom_seed_wins > 0;

  return (
    <div className="h-full flex flex-col rounded border border-border/60 bg-card/60 overflow-hidden">
      {/* Top seed */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 flex-1",
          series_complete && !topLeads && "opacity-30"
        )}
      >
        <span
          className={cn(
            "font-mono text-xs font-bold leading-none",
            topLeads ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {top_seed_abbr || "TBD"}
        </span>
        <div className="flex gap-0.5 ml-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                i < top_seed_wins ? "bg-primary" : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40 mx-1" />

      {/* Bottom seed */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 flex-1",
          series_complete && !bottomLeads && "opacity-30"
        )}
      >
        <span
          className={cn(
            "font-mono text-xs font-bold leading-none",
            bottomLeads ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {bottom_seed_abbr || "TBD"}
        </span>
        <div className="flex gap-0.5 ml-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                i < bottom_seed_wins ? "bg-primary" : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
      </div>

      {/* Status footer */}
      <div className="flex items-center gap-1 px-2 py-0.5 border-t border-border/30 bg-muted/20 shrink-0">
        {series_complete ? (
          <>
            <CheckCircle2 className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
            <span className="text-[9px] text-muted-foreground/40 truncate">
              {series_leader_abbr} wins
            </span>
          </>
        ) : active ? (
          <>
            <Circle className="h-2.5 w-2.5 text-signal-live animate-pulse shrink-0" />
            <span className="text-[9px] text-muted-foreground/60 truncate">
              {series_leader_abbr ? `${series_leader_abbr} leads` : "Tied"}
            </span>
          </>
        ) : (
          <span className="text-[9px] text-muted-foreground/30">Not started</span>
        )}
      </div>
    </div>
  );
}

// ─── Column of series for one round ──────────────────────────────────────────

function BracketColumn({
  series,
  slotCount,
  label,
}: {
  series: PlayoffSeriesData[];
  slotCount: number;
  label: string;
}) {
  const slots = Array.from({ length: slotCount }, (_, i) => series[i] ?? null);

  return (
    <div className="flex flex-col h-full w-[100px] shrink-0">
      <p className="text-[9px] font-medium text-muted-foreground/40 uppercase tracking-widest text-center mb-1.5 shrink-0">
        {label}
      </p>
      {/* Slots have no gap so SVG connector percentages align correctly */}
      <div
        className="flex-1 grid"
        style={{ gridTemplateRows: `repeat(${slotCount}, 1fr)` }}
      >
        {slots.map((s, i) => (
          <div key={s?.series_id ?? `empty-${i}`} className="p-0.5">
            <BracketCard series={s} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SVG bracket connector ───────────────────────────────────────────────────
//
// Draws bracket arms connecting an "outer" column (more series, farther from Finals)
// to an "inner" column (fewer series, closer to Finals).
//
//   direction="east"  →  outer LEFT, inner RIGHT.  Arms open left, line exits right.
//   direction="west"  →  outer RIGHT, inner LEFT.  Arms open right, line exits left.
//
// SVG viewBox 0 0 10 100 with preserveAspectRatio="none" stretches to fill the
// container, so percentage-based y-coordinates align with the grid slots above.

function BracketConnector({
  outerCount,
  innerCount,
  direction,
}: {
  outerCount: number;
  innerCount: number;
  direction: "east" | "west";
}) {
  const outerSlotH = 100 / outerCount;
  const innerSlotH = 100 / innerCount;

  const paths = Array.from({ length: innerCount }, (_, i) => {
    // Centers of the two outer slots feeding into inner slot i
    const ya = i * innerSlotH + outerSlotH / 2;
    const yb = (i + 1) * innerSlotH - outerSlotH / 2;
    // Center of inner slot i
    const ym = i * innerSlotH + innerSlotH / 2;

    return direction === "east"
      ? `M 0 ${ya} H 5 V ${yb} H 0 M 5 ${ym} H 10`
      : `M 10 ${ya} H 5 V ${yb} H 10 M 5 ${ym} H 0`;
  });

  return (
    <div className="w-8 shrink-0 h-full pt-[22px]">
      <svg
        className="h-full w-full text-border"
        viewBox="0 0 10 100"
        preserveAspectRatio="none"
      >
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="currentColor" strokeWidth="0.8" fill="none" />
        ))}
      </svg>
    </div>
  );
}

// Single horizontal line connecting CF ↔ Finals
function StraightConnector() {
  return (
    <div className="w-5 shrink-0 h-full pt-[22px]">
      <svg
        className="h-full w-full text-border"
        viewBox="0 0 10 100"
        preserveAspectRatio="none"
      >
        <line x1="0" y1="50" x2="10" y2="50" stroke="currentColor" strokeWidth="0.8" />
      </svg>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayoffsPage() {
  const { data: bracket, isLoading } = usePlayoffBracketQuery();

  const rounds = bracket?.rounds ?? [];
  const get = (round: number, conf: string) =>
    rounds.find((r) => r.round_num === round)?.series.filter((s) => s.conference === conf) ?? [];

  const eastR1 = get(1, "East");
  const eastR2 = get(2, "East");
  const eastCF = get(3, "East");
  const finals = get(4, "Finals");
  const westCF = get(3, "West");
  const westR2 = get(2, "West");
  const westR1 = get(1, "West");

  return (
    <div className="space-y-6 animate-slide-up-fade">
      {/* Header */}
      <section>
        <div className="flex items-center gap-2">
          <Medal className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-bold tracking-tight">Playoffs</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">
          {bracket
            ? `${bracket.season} NBA Playoff bracket — updated nightly`
            : "NBA playoff bracket — updated nightly."}
        </p>
      </section>

      {/* Loading */}
      {isLoading && <Skeleton className="h-[520px] w-full rounded-lg" />}

      {/* Bracket */}
      {bracket && (
        <div className="overflow-x-auto pb-2">
          {/* Conference labels */}
          <div className="flex items-center min-w-[820px] mb-2 px-0.5">
            <div className="w-[100px] shrink-0 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
              East
            </div>
            <div className="flex-1" />
            <div className="w-[100px] shrink-0 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest text-right">
              West
            </div>
          </div>

          {/* Bracket */}
          <div className="flex items-stretch h-[480px] min-w-[820px]">
            <BracketColumn series={eastR1} slotCount={4} label="First Round" />
            <BracketConnector outerCount={4} innerCount={2} direction="east" />
            <BracketColumn series={eastR2} slotCount={2} label="Semifinals" />
            <BracketConnector outerCount={2} innerCount={1} direction="east" />
            <BracketColumn series={eastCF} slotCount={1} label="Conf Finals" />
            <StraightConnector />
            <BracketColumn series={finals} slotCount={1} label="NBA Finals" />
            <StraightConnector />
            <BracketColumn series={westCF} slotCount={1} label="Conf Finals" />
            <BracketConnector outerCount={2} innerCount={1} direction="west" />
            <BracketColumn series={westR2} slotCount={2} label="Semifinals" />
            <BracketConnector outerCount={4} innerCount={2} direction="west" />
            <BracketColumn series={westR1} slotCount={4} label="First Round" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !bracket && (
        <Card variant="panel" className="p-8">
          <div className="text-center space-y-2">
            <Medal className="h-8 w-8 text-muted-foreground/20 mx-auto" />
            <p className="text-sm text-muted-foreground">No bracket data yet.</p>
            <p className="text-xs text-muted-foreground/60">
              The playoff bracket pipeline runs nightly at 1 AM ET once the playoffs begin.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
