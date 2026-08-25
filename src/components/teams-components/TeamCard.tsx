import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil, Trash2, ExternalLink, Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSyncTeamLeagueMutation, useTeamRosterQuery } from "@/hooks/useTeams";
import { useUIStore } from "@/stores/useUIStore";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CAT_VALUE_TITLE, scoringLabel } from "@/lib/category-format";
import type { TeamResponseData, FantasyProvider, LeagueSummary } from "@/types/team";

interface TeamCardProps {
  team: TeamResponseData;
  onEdit?: (team: TeamResponseData) => void;
  onDelete?: (teamId: number) => void;
}

export function TeamCard({ team, onEdit, onDelete }: TeamCardProps) {
  const { league_info } = team;
  const league = team.league ?? null;
  const isYahoo = league_info.provider === "yahoo";
  const router = useRouter();
  const setSelectedTeam = useUIStore((s) => s.setSelectedTeam);
  const [copied, setCopied] = useState(false);
  const { mutate: syncLeague, isPending: isSyncing } = useSyncTeamLeagueMutation();

  const syncedText = league?.settings_synced_at
    ? `Synced ${formatDistanceToNow(new Date(league.settings_synced_at), { addSuffix: true })} · click to re-sync`
    : "League settings not synced yet · click to sync";

  const handleCopyId = () => {
    navigator.clipboard.writeText(String(team.team_id));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const { data: roster, isLoading: isRosterLoading } = useTeamRosterQuery(
    team.team_id
  );

  const playerCount = roster?.length ?? 0;
  const avgFpts =
    roster && roster.length > 0
      ? (roster.reduce((sum, p) => sum + p.avg_points, 0) / roster.length).toFixed(1)
      : "0.0";
  const injuredCount = roster?.filter((p) => p.injured).length ?? 0;
  const isCatValue = roster?.some((p) => p.value_kind === "cat_value") ?? false;

  const handleViewTeam = () => {
    setSelectedTeam(team.team_id);
    router.push("/your-teams");
  };

  return (
    <Card className="bg-secondary/50 relative">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">
              {league_info.team_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {league_info.league_name || "Unknown League"} &middot;{" "}
              {league_info.year}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ScoringBadge league={league} />
            <ProviderBadge provider={league_info.provider} />
          </div>
        </div>

        <div className="mt-3">
          {isRosterLoading ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            <p className="text-xs text-muted-foreground">
              {playerCount} players | {avgFpts}{" "}
              {isCatValue ? (
                <span title={CAT_VALUE_TITLE} className="cursor-help">avg cat val</span>
              ) : (
                "avg"
              )}{" "}
              | {injuredCount} injured
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground font-mono">
            Team ID: <span className="text-foreground">{team.team_id}</span>
          </span>
          <button
            onClick={handleCopyId}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
            title="Copy team ID"
          >
            {copied
              ? <Check className="h-2.5 w-2.5 text-green-500" />
              : <Copy className="h-2.5 w-2.5" />
            }
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs hover:bg-input"
            onClick={handleViewTeam}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View
          </Button>

          {isYahoo ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 opacity-50 cursor-not-allowed hover:bg-input"
                      disabled
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Yahoo teams cannot be edited. Delete and reconnect to update.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 hover:bg-input"
              onClick={() => onEdit?.(team)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-7 hover:bg-input"
            onClick={() => onDelete?.(team.team_id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 hover:bg-input ml-auto"
                  onClick={() => syncLeague(team.team_id)}
                  disabled={isSyncing}
                  aria-label="Sync league settings"
                >
                  {isSyncing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{syncedText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoringBadge({ league }: { league: LeagueSummary | null }) {
  const synced = !!league?.settings_synced;
  const preview = !!league?.scoring_preview;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs shrink-0 normal-case tracking-normal",
        preview
          ? "border-status-projected/50 text-status-projected"
          : synced
            ? "border-primary/40 text-primary"
            : "border-border text-muted-foreground/60"
      )}
      title={
        preview
          ? "Display override set in Edit Team — the league's real settings are unchanged"
          : synced
            ? "Detected from your league settings"
            : "Sync to detect the league format"
      }
    >
      {scoringLabel(league)}
    </Badge>
  );
}

function ProviderBadge({ provider }: { provider?: FantasyProvider }) {
  const isYahoo = provider === "yahoo";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs shrink-0",
        isYahoo
          ? "border-purple-500 text-purple-500"
          : "border-orange-500 text-orange-500"
      )}
    >
      {isYahoo ? "Yahoo" : "ESPN"}
    </Badge>
  );
}
