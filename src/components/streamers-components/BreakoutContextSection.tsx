import { Badge } from "@/components/ui/badge";
import type { BreakoutCandidateResp } from "@/types/breakout";

export function BreakoutContextSection({ context }: { context: BreakoutCandidateResp }) {
  const { injured_player, signals } = context;

  return (
    <div className="rounded-md border border-status-projected/30 bg-status-projected/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="breakout" className="text-[10px]">OPP</Badge>
        <span className="text-xs font-semibold text-status-projected">
          Injury Opportunity
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          Score: {signals.breakout_score.toFixed(1)}
        </span>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="text-foreground font-medium">{injured_player.name}</span>
        {" "}is {injured_player.status.toLowerCase()}
        {injured_player.expected_return && (
          <span> · Return est. {injured_player.expected_return}</span>
        )}
        <span> · {injured_player.avg_min.toFixed(1)} min/g vacated</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <div className="text-xs">
          <span className="text-muted-foreground">Proj. boost </span>
          <span className="font-mono font-medium text-foreground">
            +{signals.projected_min_boost.toFixed(1)} min
          </span>
        </div>
        {signals.opp_fpts_avg !== null && (
          <div className="text-xs">
            <span className="text-muted-foreground">Opp game avg </span>
            <span className="font-mono font-medium text-foreground">
              {signals.opp_fpts_avg.toFixed(1)} fpts
            </span>
            {signals.opp_game_count > 0 && (
              <span className="text-muted-foreground"> ({signals.opp_game_count}g)</span>
            )}
          </div>
        )}
        {signals.opp_min_avg !== null && (
          <div className="text-xs">
            <span className="text-muted-foreground">Avg min in opp games </span>
            <span className="font-mono font-medium text-foreground">
              {signals.opp_min_avg.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
