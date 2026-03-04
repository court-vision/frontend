"use client";

import { Zap, AlertCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useBreakoutStreamersQuery } from "@/hooks/useBreakoutStreamers";
import { useTeamInsightsQuery } from "@/hooks/useTeams";
import { Skeleton } from "@/components/ui/skeleton";
import type { BreakoutCandidateResp } from "@/types/breakout";
import type { CategoryStrengths } from "@/types/team-insights";

// ── Weak category detection ──────────────────────────────────────────────────

interface WeakCategory {
  label: string;
  key: keyof CategoryStrengths;
  threshold: number;
}

const WEAK_CATEGORY_RULES: WeakCategory[] = [
  { label: "PTS", key: "avg_points",   threshold: 100 },
  { label: "REB", key: "avg_rebounds", threshold: 40  },
  { label: "AST", key: "avg_assists",  threshold: 20  },
  { label: "STL", key: "avg_steals",   threshold: 6.0 },
  { label: "BLK", key: "avg_blocks",   threshold: 4.0 },
  { label: "FG%", key: "avg_fg_pct",   threshold: 0.45 },
  { label: "FT%", key: "avg_ft_pct",   threshold: 0.75 },
  // turnovers: higher is worse for the team
  { label: "TOV", key: "avg_turnovers", threshold: -1  }, // handled separately below
];

function getWeakCategories(cs: CategoryStrengths): string[] {
  const weak: string[] = [];
  for (const rule of WEAK_CATEGORY_RULES) {
    if (rule.label === "TOV") {
      // TOV: flagged when avg_turnovers is high (> 12)
      if (cs.avg_turnovers > 12) weak.push("TOV");
      continue;
    }
    const val = cs[rule.key] as number;
    if (val < rule.threshold) weak.push(rule.label);
  }
  return weak;
}

// ── StreamerCard (same layout as StreamersPanel) ─────────────────────────────

interface StreamerCardProps {
  candidate: BreakoutCandidateResp;
  isActive: boolean;
  onFocus: () => void;
}

function StreamerCard({ candidate, isActive, onFocus }: StreamerCardProps) {
  const { beneficiary, injured_player, signals } = candidate;

  return (
    <button
      className={cn(
        "flex items-start gap-2 w-full px-3 py-2 text-left transition-colors border-b border-border/30",
        "hover:bg-muted/50",
        isActive && "bg-primary/10"
      )}
      onClick={onFocus}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium truncate">{beneficiary.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {beneficiary.team}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
          For:{" "}
          <span className="text-amber-500">{injured_player.name}</span>
          {" "}
          <span className="text-muted-foreground/60">({injured_player.status})</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-xs font-bold text-primary tabular-nums">
          {beneficiary.avg_fpts.toFixed(1)}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {signals.breakout_score.toFixed(0)} pts
        </div>
      </div>
    </button>
  );
}

// ── Weak category badges ──────────────────────────────────────────────────────

function WeakCategoryBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-destructive/10 text-destructive border border-destructive/20">
      {label}
    </span>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function TeamStreamersPanel() {
  const { focusedPlayerId, focusedTeamId, setFocusedPlayer } = useTerminalStore();

  const { data: streamersData, isLoading: streamersLoading, error: streamersError } =
    useBreakoutStreamersQuery(15);

  const { data: insightsData, isLoading: insightsLoading } =
    useTeamInsightsQuery(focusedTeamId);

  // ── No team selected ────────────────────────────────────────────────────────
  if (focusedTeamId === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <Users className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">
          Select a team to see personalized streamers
        </p>
      </div>
    );
  }

  // ── Streamers loading/error states ─────────────────────────────────────────
  if (streamersLoading) {
    return (
      <div className="flex flex-col h-full p-2 gap-2">
        <Skeleton className="h-6 w-3/4" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (streamersError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="h-6 w-6 text-destructive/50 mb-2" />
        <p className="text-sm text-destructive">Failed to load streamers</p>
      </div>
    );
  }

  const candidates = streamersData?.candidates ?? [];

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Zap className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No breakout candidates</p>
      </div>
    );
  }

  // ── Category weakness context ───────────────────────────────────────────────
  const categoryStrengths = insightsData?.category_strengths ?? null;
  const weakCategories = categoryStrengths ? getWeakCategories(categoryStrengths) : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Weak category context header */}
      {!insightsLoading && weakCategories.length > 0 && (
        <div className="px-3 py-2 border-b border-border/40 bg-muted/20 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide shrink-0">
              Weak:
            </span>
            {weakCategories.map((cat) => (
              <WeakCategoryBadge key={cat} label={cat} />
            ))}
          </div>
        </div>
      )}

      {/* Streamers list */}
      <div className="flex-1 overflow-y-auto">
        {candidates.map((candidate) => (
          <StreamerCard
            key={candidate.beneficiary.player_id}
            candidate={candidate}
            isActive={candidate.beneficiary.player_id === focusedPlayerId}
            onFocus={() => setFocusedPlayer(candidate.beneficiary.player_id)}
          />
        ))}
      </div>

      {/* Footer */}
      {streamersData?.as_of_date && (
        <div className="px-3 py-1 border-t text-[10px] text-muted-foreground font-mono shrink-0">
          As of {streamersData.as_of_date}
        </div>
      )}
    </div>
  );
}
