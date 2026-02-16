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
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { useTeamRosterQuery } from "@/hooks/useTeams";
import { useUIStore } from "@/stores/useUIStore";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { TeamResponseData, FantasyProvider } from "@/types/team";

interface TeamCardProps {
  team: TeamResponseData;
  onEdit?: (team: TeamResponseData) => void;
  onDelete?: (teamId: number) => void;
}

export function TeamCard({ team, onEdit, onDelete }: TeamCardProps) {
  const { league_info } = team;
  const isYahoo = league_info.provider === "yahoo";
  const router = useRouter();
  const setSelectedTeam = useUIStore((s) => s.setSelectedTeam);

  const { data: roster, isLoading: isRosterLoading } = useTeamRosterQuery(
    team.team_id
  );

  const playerCount = roster?.length ?? 0;
  const avgFpts =
    roster && roster.length > 0
      ? (roster.reduce((sum, p) => sum + p.avg_points, 0) / roster.length).toFixed(1)
      : "0.0";
  const injuredCount = roster?.filter((p) => p.injured).length ?? 0;

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
          <ProviderBadge provider={league_info.provider} />
        </div>

        <div className="mt-3">
          {isRosterLoading ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            <p className="text-xs text-muted-foreground">
              {playerCount} players | {avgFpts} avg | {injuredCount} injured
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center gap-1.5">
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
        </div>
      </CardContent>
    </Card>
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
