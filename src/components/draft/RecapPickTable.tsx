"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  pickColumnsFor,
  pickNaturalDirection,
  pickSourceGlyph,
  signed,
  slotLabel,
  sortPicks,
} from "@/lib/draft-recap";
import { SortIcon } from "@/components/draft/DraftBoardTable";
import { RecapSectionBar } from "@/components/draft/RecapSectionBar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PickSortKey, RecapMeta, RecapPick, RecapSeat, SortDirection } from "@/types/draft";

function num(value: number | null | undefined, decimals = 1): string {
  return value === null || value === undefined ? "—" : value.toFixed(decimals);
}

/** Green for a surplus, red for a reach, muted for nothing either way. */
function signTone(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-muted-foreground/50";
  if (value > 0) return "text-status-win";
  if (value < 0) return "text-status-loss";
  return "text-muted-foreground";
}

const ALIGN: Record<"left" | "right" | "center", string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

interface RecapPickTableProps {
  picks: RecapPick[];
  seats: RecapSeat[];
  meta: RecapMeta | null;
  /** Only this seat's picks, when a seat card is selected. */
  selectedSlot: number | null;
  onClearFilter: () => void;
}

/**
 * Every pick, priced. Sortable on each column the way the board is — a click
 * on a new column opens it the way it reads best, a second click flips it —
 * with the caller's picks marked and a pick nothing could value sorting last.
 */
export function RecapPickTable({ picks, seats, meta, selectedSlot, onClearFilter }: RecapPickTableProps) {
  const [sort, setSort] = useState<{ key: PickSortKey; direction: SortDirection }>({
    key: "overall_pick",
    direction: "asc",
  });
  const columns = useMemo(() => pickColumnsFor(meta), [meta]);
  const rows = useMemo(() => {
    const shown = selectedSlot === null ? picks : picks.filter((p) => p.slot === selectedSlot);
    return sortPicks(shown, sort.key, sort.direction);
  }, [picks, selectedSlot, sort]);

  const toggleSort = (key: PickSortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: pickNaturalDirection(key) }
    );

  const cell = (pick: RecapPick, key: PickSortKey): React.ReactNode => {
    switch (key) {
      case "overall_pick":
        return pick.overall_pick;
      case "round":
        return pick.round ?? "—";
      case "slot":
        return slotLabel(pick.slot, seats);
      case "player_name": {
        const mark = pickSourceGlyph(pick.source);
        return (
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate", pick.by_me && "font-medium text-primary")}>
              {pick.player_name ?? `Pick ${pick.overall_pick}`}
            </span>
            {mark && (
              <span
                title={mark.title}
                className="shrink-0 rounded border border-border/50 px-1 text-[9px] text-muted-foreground/70"
              >
                {mark.glyph}
              </span>
            )}
          </span>
        );
      }
      case "team":
        return pick.team ?? "—";
      case "value":
        return num(pick.value);
      case "cv_rank":
        return pick.cv_rank ?? "—";
      case "surplus_cv":
        return <span className={signTone(pick.surplus_cv)}>{signed(pick.surplus_cv, 0)}</span>;
      case "adp":
        return num(pick.adp);
      case "surplus_market":
        return <span className={signTone(pick.surplus_market)}>{signed(pick.surplus_market)}</span>;
      case "value_over_slot":
        return <span className={signTone(pick.value_over_slot)}>{signed(pick.value_over_slot)}</span>;
      case "bid":
        return pick.bid === null || pick.bid === undefined ? "—" : `$${pick.bid.toFixed(0)}`;
    }
  };

  return (
    <div>
      <RecapSectionBar
        title="Picks"
        right={
          selectedSlot === null ? (
            <span>{rows.length}</span>
          ) : (
            <button
              type="button"
              onClick={onClearFilter}
              className="flex items-center gap-1 rounded border border-primary/40 bg-primary/5 px-1.5 text-primary transition-colors hover:bg-primary/10"
            >
              {slotLabel(selectedSlot, seats).replace(" · you", "")} only · {rows.length}
              <X className="h-3 w-3" />
            </button>
          )
        }
      />
      <Table className="font-mono text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => {
              const active = sort.key === col.key;
              return (
                <TableHead
                  key={col.key}
                  className={cn("h-8 px-2 text-[10px] uppercase tracking-wider", col.className)}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    title={col.title}
                    className={cn(
                      "flex w-full items-center gap-0.5 transition-colors hover:text-foreground",
                      col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start",
                      active && "text-foreground"
                    )}
                  >
                    <span className="truncate">{col.label}</span>
                    <SortIcon active={active} direction={active ? sort.direction : undefined} />
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((pick) => (
            <TableRow
              key={pick.overall_pick}
              className={cn("tabular-nums", pick.by_me && "bg-primary/5")}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    "px-2 py-1",
                    ALIGN[col.align],
                    col.className,
                    col.key === "slot" && "whitespace-nowrap"
                  )}
                >
                  {cell(pick, col.key)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-6 text-center text-muted-foreground">
                No picks for this seat.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
