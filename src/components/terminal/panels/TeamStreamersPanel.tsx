"use client";

import { useMemo } from "react";
import { Zap, AlertCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useFocusPlayer } from "@/hooks/useFocusPlayer";
import { useBreakoutStreamersQuery } from "@/hooks/useBreakoutStreamers";
import { useStreamersQuery } from "@/hooks/useStreamers";
import { useTeamInsightsQuery } from "@/hooks/useTeams";
import { useTeams } from "@/app/context/TeamsContext";
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
  { label: "TOV", key: "avg_turnovers", threshold: -1  },
];

function getWeakCategories(cs: CategoryStrengths): string[] {
  const weak: string[] = [];
  for (const rule of WEAK_CATEGORY_RULES) {
    if (rule.label === "TOV") {
      if (cs.avg_turnovers > 12) weak.push("TOV");
      continue;
    }
    const val = cs[rule.key] as number;
    if (val < rule.threshold) weak.push(rule.label);
  }
  return weak;
}

// ── Unified streamer item ────────────────────────────────────────────────────

interface UnifiedStreamer {
  playerId: number;
  name: string;
  team: string;
  avgFpts: number;
  score: number;
  tag: "OPP" | "B2B" | null;
  breakoutContext?: BreakoutCandidateResp;
}

function StreamerCard({
  streamer,
  isActive,
  onFocus,
}: {
  streamer: UnifiedStreamer;
  isActive: boolean;
  onFocus: () => void;
}) {
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
          <span className="text-xs font-medium truncate">{streamer.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {streamer.team}
          </span>
          {streamer.tag && (
            <span
              className={cn(
                "text-[9px] font-mono font-bold px-1 rounded",
                streamer.tag === "OPP"
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-blue-500/15 text-blue-400"
              )}
            >
              {streamer.tag}
            </span>
          )}
        </div>
        {streamer.breakoutContext && (
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
            For:{" "}
            <span className="text-amber-500">
              {streamer.breakoutContext.injured_player.name}
            </span>{" "}
            <span className="text-muted-foreground/60">
              ({streamer.breakoutContext.injured_player.status})
            </span>
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-xs font-bold text-primary tabular-nums">
          {streamer.avgFpts.toFixed(1)}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {streamer.score.toFixed(0)} pts
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
  const { focusedPlayerId, focusedTeamId } = useTerminalStore();
  const focusPlayer = useFocusPlayer();
  const { selectedTeam, teams } = useTeams();

  // Use focusedTeamId (terminal mode) or selectedTeam (dashboard mode)
  const teamId = focusedTeamId ?? selectedTeam;

  const selectedTeamData = useMemo(
    () => teams.find((t) => t.team_id === teamId),
    [teams, teamId]
  );
  const leagueInfo = selectedTeamData?.league_info || null;

  const { data: breakoutData, isLoading: breakoutLoading, error: breakoutError } =
    useBreakoutStreamersQuery(30);
  const { data: streamerData, isLoading: streamerLoading } =
    useStreamersQuery(leagueInfo, teamId, {
      faCount: 50,
      excludeInjured: true,
      mode: "daily",
    });

  const { data: insightsData, isLoading: insightsLoading } =
    useTeamInsightsQuery(focusedTeamId);

  const isLoading = breakoutLoading || (!!leagueInfo && streamerLoading);

  // ── No team selected ────────────────────────────────────────────────────────
  if (teamId === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <Users className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">
          Select a team to see personalized streamers
        </p>
      </div>
    );
  }

  // ── Loading/error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-2 gap-2">
        <Skeleton className="h-6 w-3/4" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (breakoutError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="h-6 w-6 text-destructive/50 mb-2" />
        <p className="text-sm text-destructive">Failed to load streamers</p>
      </div>
    );
  }

  // ── Merge and sort ──────────────────────────────────────────────────────────
  const seen = new Set<number>();
  const items: UnifiedStreamer[] = [];

  const breakoutMap = new Map<number, BreakoutCandidateResp>();
  for (const c of breakoutData?.candidates ?? []) {
    breakoutMap.set(c.beneficiary.player_id, c);
  }

  if (streamerData?.streamers) {
    for (const s of streamerData.streamers) {
      seen.add(s.player_id);
      items.push({
        playerId: s.player_id,
        name: s.name,
        team: s.team,
        avgFpts: s.avg_points_last_n ?? s.avg_points_season,
        score: s.streamer_score,
        tag: breakoutMap.has(s.player_id) ? "OPP" : s.has_b2b ? "B2B" : null,
        breakoutContext: breakoutMap.get(s.player_id),
      });
    }
  }

  for (const c of breakoutData?.candidates ?? []) {
    if (seen.has(c.beneficiary.player_id)) continue;
    seen.add(c.beneficiary.player_id);
    items.push({
      playerId: c.beneficiary.player_id,
      name: c.beneficiary.name,
      team: c.beneficiary.team,
      avgFpts: c.beneficiary.avg_fpts,
      score: c.signals.breakout_score,
      tag: "OPP",
      breakoutContext: c,
    });
  }

  items.sort((a, b) => b.score - a.score);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Zap className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No streamers available</p>
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
        {items.map((streamer) => (
          <StreamerCard
            key={streamer.playerId}
            streamer={streamer}
            isActive={streamer.playerId === focusedPlayerId}
            onFocus={() => focusPlayer(streamer.playerId)}
          />
        ))}
      </div>
    </div>
  );
}
