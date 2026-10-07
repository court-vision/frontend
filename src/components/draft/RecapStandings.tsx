"use client";

import { cn } from "@/lib/utils";
import { OUTCOME_CLASSES, polarityGlyph } from "@/lib/category-format";
import {
  h2hCell,
  h2hOutcome,
  positionLabel,
  rankTone,
  seatLabel,
  sortStandings,
  type RankTone,
  type StandingsMode,
} from "@/lib/draft-recap";
import { RecapSectionBar } from "@/components/draft/RecapSectionBar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecapMeta, RecapSeat, RecapStanding } from "@/types/draft";

/** Rank tint, on the same tokens the matchup page colours a category with. */
const RANK_TONE_CLASSES: Record<RankTone, string> = {
  high: "text-status-win",
  mid: "text-muted-foreground",
  low: "text-status-loss",
};

interface RecapStandingsProps {
  standings: RecapStanding[];
  seats: RecapSeat[];
  meta: RecapMeta | null;
  mode: Exclude<StandingsMode, "none">;
}

/**
 * Where the drafted rosters project to finish. A category league gets each
 * seat's per-category z-sum ranked into roto points and the categories it
 * wins head to head; a points league gets projected season value. Neither is
 * a season simulation, and the band says so.
 */
export function RecapStandings({ standings, seats, meta, mode }: RecapStandingsProps) {
  const ordered = sortStandings(standings, mode);
  const seatOf = (slot: number) => seats.find((s) => s.slot === slot);
  const label = (slot: number) => {
    const seat = seatOf(slot);
    return seat ? seatLabel(seat) : `Seat ${slot}`;
  };
  const mine = (slot: number) => seatOf(slot)?.is_me ?? false;

  if (mode === "points") {
    const ranks = ordered.map((s) => s.value_rank);
    return (
      <div>
        <RecapSectionBar
          title="Projected standings"
          right="season value from the draft — not a season simulation"
        />
        <Table className="font-mono text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 w-14 px-2 text-[10px] uppercase tracking-wider">Rank</TableHead>
              <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wider">Seat</TableHead>
              <TableHead
                className="h-8 w-28 px-2 text-right text-[10px] uppercase tracking-wider"
                title="Value per game × projected games, summed over the seat's picks"
              >
                Season value
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((row) => (
              <TableRow key={row.slot} className={cn("tabular-nums", mine(row.slot) && "bg-primary/5")}>
                <TableCell className="px-2 py-1">{positionLabel(row.value_rank, ranks)}</TableCell>
                <TableCell className={cn("px-2 py-1", mine(row.slot) && "font-medium text-primary")}>
                  {label(row.slot)}
                </TableCell>
                <TableCell className="px-2 py-1 text-right">
                  {row.season_value === null || row.season_value === undefined
                    ? "—"
                    : row.season_value.toFixed(0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  const categories = meta?.categories ?? [];
  const n = standings.length;
  const ranksIn = (key: string) =>
    standings.map((s) => s.categories.find((line) => line.key === key)?.rank ?? null);
  const rotoRanks = ordered.map((s) => s.roto_rank);
  const slots = ordered.map((s) => s.slot);

  return (
    <div>
      <RecapSectionBar
        title="Projected standings"
        right="per-category z-sums ranked into roto points — not a season simulation"
      />
      <Table className="font-mono text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wider">Seat</TableHead>
            {categories.map((def) => (
              <TableHead
                key={def.key}
                title={`${def.label}: summed per-player z, best first`}
                className="h-8 w-14 px-2 text-right text-[10px] uppercase tracking-wider"
              >
                {def.label}
                {polarityGlyph(def)}
              </TableHead>
            ))}
            <TableHead
              className="h-8 w-14 px-2 text-right text-[10px] uppercase tracking-wider"
              title="Roto points across the categories"
            >
              Roto
            </TableHead>
            <TableHead className="h-8 w-14 px-2 text-right text-[10px] uppercase tracking-wider">
              Rank
            </TableHead>
            <TableHead
              className="h-8 w-12 px-2 text-right text-[10px] uppercase tracking-wider"
              title="Categories won in an average matchup against the other seats; a tie counts half"
            >
              xW
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordered.map((row) => {
            const lines = new Map(row.categories.map((line) => [line.key, line]));
            return (
              <TableRow key={row.slot} className={cn("tabular-nums", mine(row.slot) && "bg-primary/5")}>
                <TableCell className={cn("px-2 py-1", mine(row.slot) && "font-medium text-primary")}>
                  {label(row.slot)}
                </TableCell>
                {categories.map((def) => {
                  const line = lines.get(def.key);
                  const tone = rankTone(line?.rank ?? null, n);
                  return (
                    <TableCell
                      key={def.key}
                      title={
                        line
                          ? `${def.label}: ${positionLabel(line.rank, ranksIn(def.key))} of ${n} · ${line.roto_points} roto pts`
                          : undefined
                      }
                      className={cn("px-2 py-1 text-right", tone && RANK_TONE_CLASSES[tone])}
                    >
                      {line ? line.z_sum.toFixed(1) : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="px-2 py-1 text-right">
                  {row.roto_points === null || row.roto_points === undefined ? "—" : row.roto_points.toFixed(1)}
                </TableCell>
                <TableCell className="px-2 py-1 text-right">{positionLabel(row.roto_rank, rotoRanks)}</TableCell>
                <TableCell className="px-2 py-1 text-right">
                  {row.expected_wins === null || row.expected_wins === undefined ? "—" : row.expected_wins.toFixed(1)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <RecapSectionBar title="Head to head" right="categories won – lost – tied against each seat" />
      <Table className="font-mono text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wider">Seat</TableHead>
            {slots.map((slot) => (
              <TableHead
                key={slot}
                title={label(slot)}
                className="h-8 w-16 px-2 text-center text-[10px] uppercase tracking-wider"
              >
                vs {slot}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordered.map((row) => (
            <TableRow key={row.slot} className={cn("tabular-nums", mine(row.slot) && "bg-primary/5")}>
              <TableCell className={cn("px-2 py-1", mine(row.slot) && "font-medium text-primary")}>
                {label(row.slot)}
              </TableCell>
              {slots.map((slot) => {
                if (slot === row.slot) {
                  return (
                    <TableCell key={slot} className="px-2 py-1 text-center text-muted-foreground/30">
                      —
                    </TableCell>
                  );
                }
                const cell = h2hCell(row, slot);
                if (!cell) {
                  return (
                    <TableCell key={slot} className="px-2 py-1 text-center text-muted-foreground/50">
                      —
                    </TableCell>
                  );
                }
                return (
                  <TableCell
                    key={slot}
                    title={`${label(row.slot)} vs ${label(slot)}: ${cell.won} won, ${cell.lost} lost, ${cell.tied} tied`}
                    className={cn("px-2 py-1 text-center", OUTCOME_CLASSES[h2hOutcome(cell)].text)}
                  >
                    {cell.won}–{cell.lost}–{cell.tied}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
