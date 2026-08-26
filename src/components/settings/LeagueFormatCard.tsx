"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HintPopover } from "@/components/ui/hint";
import { Skeleton } from "@/components/ui/skeleton";
import {
  polarityGlyph,
  scoringLabel,
  statLabel,
  winModeLabel,
} from "@/lib/category-format";
import { cn } from "@/lib/utils";
import type { LeagueDetail, TeamResponseData } from "@/types/team";

interface LeagueFormatCardProps {
  team: TeamResponseData;
  league: LeagueDetail | null;
  isLoading: boolean;
  onSync: () => void;
  isSyncing: boolean;
}

function formatWeight(w: number): string {
  const rounded = Math.round(w * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toString();
  return rounded > 0 ? `+${text}` : text;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  );
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Turn the provider-specific `matchup_periods` blob into label/value rows. */
function scheduleRows(periods: Record<string, unknown>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const count = asNumber(periods.period_count);
  const length = asNumber(periods.period_length);
  const startWeek = asNumber(periods.start_week);
  const endWeek = asNumber(periods.end_week);
  const playoffStart = asNumber(periods.playoff_start_week);
  const playoffTeams = asNumber(periods.playoff_team_count);
  const playoffLength = asNumber(periods.playoff_period_length);

  if (startWeek !== null && endWeek !== null) rows.push({ label: "Weeks", value: `${startWeek}–${endWeek}` });
  if (count !== null) rows.push({ label: "Matchup periods", value: String(count) });
  if (length !== null) rows.push({ label: "Weeks per period", value: String(length) });
  if (playoffTeams !== null) rows.push({ label: "Playoff teams", value: String(playoffTeams) });
  if (playoffStart !== null) rows.push({ label: "Playoffs start", value: `Week ${playoffStart}` });
  if (playoffLength !== null) rows.push({ label: "Playoff period", value: `${playoffLength} wk` });
  return rows;
}

export function LeagueFormatCard({ team, league, isLoading, onSync, isSyncing }: LeagueFormatCardProps) {
  const { league_info } = team;
  const providerName = league_info.provider === "yahoo" ? "Yahoo" : "ESPN";

  const syncButton = (
    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onSync} disabled={isSyncing}>
      {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      {league ? "Re-sync" : "Sync now"}
    </Button>
  );

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold truncate">{league_info.team_name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {league?.name || league_info.league_name || "Unknown League"} · {league?.season ?? league_info.year} ·{" "}
          {providerName}
        </p>
      </div>
      {syncButton}
    </div>
  );

  if (isLoading) {
    return (
      <Card variant="panel" className="p-4 space-y-3">
        {header}
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (!league) {
    return (
      <Card variant="panel" className="p-4 space-y-3">
        {header}
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          We haven&apos;t pulled this league&apos;s scoring settings from {providerName} yet. Sync to detect
          whether it scores by points or categories — matchups, rankings, and analytics adapt automatically.
        </div>
      </Card>
    );
  }

  const winMode = winModeLabel(league.category_win_mode);
  const weights = Object.entries(league.point_weights ?? {})
    .filter(([, w]) => typeof w === "number" && w !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const slots = Object.entries(league.roster_slots ?? {}).filter(([, n]) => n > 0);
  const schedule = scheduleRows(league.matchup_periods ?? {});
  const syncedAgo = league.settings_synced_at
    ? formatDistanceToNow(new Date(league.settings_synced_at), { addSuffix: true })
    : null;

  return (
    <Card variant="panel" className="p-4 space-y-4">
      {header}

      {/* Preview override note */}
      {league.scoring_preview && (
        <div className="rounded-md border border-status-projected/30 bg-status-projected/10 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-status-projected">Preview mode.</span> This team is shown as{" "}
          {league.scoring_preview === "categories" ? "an H2H category league" : "an H2H points league"} regardless of
          its real settings. Change it under Manage Teams → Edit → View as.
        </div>
      )}

      {/* Format */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "normal-case tracking-normal text-xs",
            league.settings_synced ? "border-primary/40 text-primary" : "border-border text-muted-foreground"
          )}
        >
          {scoringLabel(league)}
        </Badge>
        {winMode && (
          <Badge variant="neutral" className="normal-case tracking-normal text-[11px] font-medium">
            {winMode}
          </Badge>
        )}
        <span className="text-[11px] text-muted-foreground/70 ml-auto">
          {league.settings_synced && syncedAgo
            ? `Synced ${syncedAgo}`
            : "Provider settings unavailable — using default points scoring"}
        </span>
      </div>

      {/* Categories */}
      {league.scoring_type === "categories" && league.categories.length > 0 && (
        <div className="space-y-2">
          <SectionTitle>Categories ({league.categories.length})</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {league.categories.map((c) => (
              <HintPopover key={c.key} content={c.higher_is_better ? "Higher is better" : "Lower is better"}>
                <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/30 px-2 py-0.5 text-xs font-mono">
                  {c.label}
                  {polarityGlyph(c) && <span className="text-muted-foreground">{polarityGlyph(c)}</span>}
                  {c.is_rate && <span className="text-[9px] text-muted-foreground/60 uppercase">rate</span>}
                </span>
              </HintPopover>
            ))}
          </div>
        </div>
      )}

      {/* Point weights */}
      {league.scoring_type === "points" && weights.length > 0 && (
        <div className="space-y-2">
          <SectionTitle>Point weights</SectionTitle>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs font-mono">
            {weights.map(([key, w]) => (
              <div key={key} className="flex items-center justify-between border-b border-border/40 py-0.5">
                <span className="text-muted-foreground">{statLabel(key)}</span>
                <span className={cn(w < 0 ? "text-status-loss" : "text-foreground")}>{formatWeight(w)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roster + schedule */}
      {(slots.length > 0 || schedule.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {slots.length > 0 && (
            <div className="space-y-2">
              <SectionTitle>Roster slots</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {slots.map(([slot, n]) => (
                  <span key={slot} className="rounded border border-border bg-muted/30 px-2 py-0.5 text-xs font-mono">
                    {slot} <span className="text-muted-foreground">×{n}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {schedule.length > 0 && (
            <div className="space-y-2">
              <SectionTitle>Schedule</SectionTitle>
              <dl className="text-xs space-y-0.5">
                {schedule.map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="font-mono">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}

      {/* Warnings / unsupported */}
      {league.warnings.length > 0 && (
        <div className="rounded-md border border-status-projected/30 bg-status-projected/10 p-3 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-status-projected">
            <AlertTriangle className="h-3.5 w-3.5" />
            Heads up
          </p>
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
            {league.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {league.unsupported.length > 0 && (
        <p className="text-[11px] text-muted-foreground/70">
          Not used by Court Vision: {league.unsupported.map(statLabel).join(", ")}
        </p>
      )}
    </Card>
  );
}
