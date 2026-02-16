"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FantasyProvider } from "@/types/team";
import type { EnrichedRosterPlayer } from "@/types/team-insights";
import PlayerStatDisplay from "@/components/rankings-components/PlayerStatDisplay";

type StatWindow = "season" | "l7" | "l14" | "l30";

const STAT_WINDOW_LABELS: Record<StatWindow, string> = {
  season: "Season",
  l7: "L7",
  l14: "L14",
  l30: "L30",
};

function getPlayerPoints(player: EnrichedRosterPlayer, window: StatWindow): number {
  switch (window) {
    case "l7":
      return player.avg_fpts_l7 ?? player.avg_points;
    case "l14":
      return player.avg_fpts_l14 ?? player.avg_points;
    case "l30":
      return player.avg_fpts_l30 ?? player.avg_points;
    default:
      return player.avg_points;
  }
}

function getInjuryBadge(status: string | null) {
  if (!status) return null;
  const upper = status.toUpperCase();

  if (["OUT", "O", "IL", "IL+"].includes(upper)) {
    return (
      <Badge className="text-[10px] px-1 py-0 h-4 bg-red-500/15 text-red-500 border-red-500/30">
        {upper}
      </Badge>
    );
  }
  if (["DTD", "DAY_TO_DAY"].includes(upper)) {
    return (
      <Badge className="text-[10px] px-1 py-0 h-4 bg-orange-500/15 text-orange-500 border-orange-500/30">
        {upper === "DAY_TO_DAY" ? "DTD" : upper}
      </Badge>
    );
  }
  if (["GTD", "QUESTIONABLE", "DOUBTFUL"].includes(upper)) {
    return (
      <Badge className="text-[10px] px-1 py-0 h-4 bg-yellow-500/15 text-yellow-500 border-yellow-500/30">
        {upper === "QUESTIONABLE" ? "Q" : upper === "DOUBTFUL" ? "DBT" : upper}
      </Badge>
    );
  }
  return null;
}

interface SelectedPlayer {
  playerId: number;
  playerName: string;
  playerTeam: string;
}

interface RosterDisplayProps {
  roster: EnrichedRosterPlayer[];
  provider?: FantasyProvider;
}

export function RosterDisplay({ roster, provider = "espn" }: RosterDisplayProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null);
  const [statWindow, setStatWindow] = useState<StatWindow>("season");
  const [search, setSearch] = useState("");

  const filteredAndSorted = useMemo(() => {
    const filtered = search
      ? roster.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      : roster;
    return [...filtered].sort(
      (a, b) => getPlayerPoints(b, statWindow) - getPlayerPoints(a, statWindow)
    );
  }, [roster, search, statWindow]);

  const rosterAvg = useMemo(() => {
    if (filteredAndSorted.length === 0) return 0;
    const total = filteredAndSorted.reduce(
      (sum, p) => sum + getPlayerPoints(p, statWindow),
      0
    );
    return total / filteredAndSorted.length;
  }, [filteredAndSorted, statWindow]);

  const handlePlayerClick = (player: EnrichedRosterPlayer) => {
    setSelectedPlayer({
      playerId: player.player_id,
      playerName: player.name,
      playerTeam: player.team,
    });
  };

  return (
    <>
      <Card variant="panel" className="w-full overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <Input
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 font-mono text-xs max-w-[200px]"
          />
          <Select value={statWindow} onValueChange={(v) => setStatWindow(v as StatWindow)}>
            <SelectTrigger className="h-7 w-[90px] font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STAT_WINDOW_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key} className="font-mono text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] pl-4">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="w-[60px]">Team</TableHead>
                <TableHead className="w-[100px] text-right">
                  Avg Pts
                </TableHead>
                <TableHead className="w-[70px] text-right">Games</TableHead>
                <TableHead className="w-[120px] text-right pr-4">
                  Positions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((player, index) => (
                <TableRow
                  key={`${player.player_id}-${index}`}
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-l-2 border-l-transparent hover:border-l-primary"
                  onClick={() => handlePlayerClick(player)}
                >
                  <TableCell className="pl-4 font-mono text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    <span className="flex items-center gap-1.5">
                      {player.name}
                      {getInjuryBadge(player.injury_status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {player.team}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {getPlayerPoints(player, statWindow).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    <span className="flex items-center justify-end gap-1">
                      {player.schedule?.games_remaining ?? "-"}
                      {player.schedule?.has_b2b && (
                        <Badge className="text-[10px] px-1 py-0 h-4 bg-orange-500/15 text-orange-500 border-orange-500/30">
                          B2B
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <span className="flex items-center justify-end gap-0.5 flex-wrap">
                      {player.valid_positions
                        .slice(0, player.valid_positions.length - 3)
                        .map((pos) => (
                          <Badge
                            key={pos}
                            variant="outline"
                            className="text-[10px] px-1 py-0 h-4"
                          >
                            {pos}
                          </Badge>
                        ))}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Summary footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">
              Roster Average ({STAT_WINDOW_LABELS[statWindow]})
            </span>
            <span className="font-mono text-sm font-medium tabular-nums">
              {rosterAvg.toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Player Stats Dialog */}
      <Dialog
        open={!!selectedPlayer}
        onOpenChange={() => setSelectedPlayer(null)}
      >
        <DialogContent className="max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Player Details</DialogTitle>
            <DialogDescription>
              Detailed stats and performance history.
            </DialogDescription>
          </DialogHeader>

          {selectedPlayer && (
            <PlayerStatDisplay
              playerId={selectedPlayer.playerId}
              playerName={selectedPlayer.playerName}
              playerTeam={selectedPlayer.playerTeam}
              provider={provider}
            />
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
