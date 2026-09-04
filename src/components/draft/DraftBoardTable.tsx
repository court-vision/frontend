"use client";

import { useEffect, useMemo, type KeyboardEvent, type RefObject } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Table } from "lucide-react";

import { cn } from "@/lib/utils";
import { countCapped, visibleRows } from "@/lib/draft-board";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDraftRoomStore } from "@/stores/useDraftRoomStore";
import { POSITION_FILTERS } from "@/types/draft";
import type { BoardSortKey, DraftBoardMeta, DraftBoardRow, SortDirection } from "@/types/draft";

interface ColumnDef {
  key: BoardSortKey;
  label: string;
  width?: string;
  title?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "cv_rank", label: "#", width: "w-10", title: "CV rank over the full pool — stable all draft long" },
  { key: "name", label: "Player", width: "flex-[3]" },
  { key: "value", label: "Value", width: "w-16", title: "Per-game value under this league's scoring" },
  { key: "market_rank", label: "Mkt", width: "w-12", title: "ESPN editorial draft rank" },
  { key: "adp", label: "ADP", width: "w-14", title: "Average draft position across real ESPN drafts" },
  { key: "market_delta", label: "Δ", width: "w-12", title: "market rank − CV rank; positive is a bargain" },
  { key: "projected_gp", label: "GP", width: "w-12", title: "Projected games this season" },
];

function SortIcon({ active, direction }: { active: boolean; direction?: SortDirection }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function num(value: number | null | undefined, decimals = 1): string {
  return value === null || value === undefined ? "—" : value.toFixed(decimals);
}

interface DraftBoardTableProps {
  rows: DraftBoardRow[];
  meta: DraftBoardMeta | null;
  message: string;
  isLoading: boolean;
  /** Omitted on a read-only board (the stateless pre-draft view). */
  onPick?: (row: DraftBoardRow, byMe: boolean) => void;
  isPicking?: boolean;
  /**
   * Keyboard actions on the highlighted row. The room owns them so `/`, `o`,
   * `m` and ⌘Z work from anywhere on the page, not only inside the input.
   */
  onMark?: (byMe: boolean) => void;
  onMove?: (delta: 1 | -1) => void;
  onUndoLast?: () => void;
  /** Owned by the room so `/` can focus the pick input. */
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Pending keepers, pre-marked so nobody drafts his own keeper by accident. */
  keeperIds?: ReadonlySet<number>;
  /**
   * `d` on the page or ⌥↵ in the input: send the highlighted player to ESPN as
   * your pick. Absent when the room cannot write to ESPN; nothing then hints at it.
   */
  onDraftHighlighted?: () => void;
  /** The ESPN id of a pick sent to ESPN and not yet answered, for the row badge. */
  pendingEspnId?: number | null;
  /** The row's own "ESPN" button; absent when the room cannot write to ESPN. */
  onDraftRow?: (row: DraftBoardRow) => void;
  canDraft?: boolean;
  draftDisabledReason?: string | null;
}

export function DraftBoardTable({
  rows,
  meta,
  message,
  isLoading,
  onPick,
  isPicking = false,
  onMark,
  onMove,
  onUndoLast,
  inputRef,
  keeperIds,
  onDraftHighlighted,
  pendingEspnId = null,
  onDraftRow,
  canDraft = false,
  draftDisabledReason = null,
}: DraftBoardTableProps) {
  const {
    sortKey,
    sortDirection,
    positionFilter,
    hideCapped,
    search,
    highlightId,
    toggleSort,
    setPositionFilter,
    setHideCapped,
    setSearch,
    setHighlight,
  } = useDraftRoomStore();

  const visible = useMemo(
    () => visibleRows(rows, { sortKey, sortDirection, positionFilter, hideCapped, search }),
    [rows, search, hideCapped, positionFilter, sortKey, sortDirection]
  );

  const cappedCount = useMemo(() => countCapped(rows), [rows]);

  // The row a keystroke lands on: the highlighted one while it is visible,
  // else the top match — so typing a name and pressing Enter needs no arrow.
  const activeId = visible.some((row) => row.player_id === highlightId)
    ? highlightId
    : (visible[0]?.player_id ?? null);

  useEffect(() => {
    if (activeId === null || !onMark) return;
    document.getElementById(`draft-row-${activeId}`)?.scrollIntoView({ block: "nearest" });
  }, [activeId, onMark]);

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      onMove?.(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // A plain `d` is a letter in here, so the ESPN send is ⌥↵ in the input.
      if (e.altKey && onDraftHighlighted) onDraftHighlighted();
      else onMark?.(e.shiftKey || e.metaKey || e.ctrlKey);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (search) setSearch("");
      else e.currentTarget.blur();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && search === "") {
      // With nothing typed there is no text to undo; undo the last pick instead.
      e.preventDefault();
      onUndoLast?.();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-1 p-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Pick input + filters */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/50 shrink-0">
        <div className="relative flex-1 min-w-0 max-w-[260px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setHighlight(null);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={
              onMark
                ? onDraftHighlighted
                  ? "Type a name, ↵ out, ⇧↵ mine, ⌥↵ draft"
                  : "Type a name, ↵ out, ⇧↵ mine"
                : "Filter players..."
            }
            aria-label={onMark ? "Pick input" : "Filter players"}
            className="h-7 pl-7 pr-7 text-xs font-mono bg-background/50 border-border/50 focus:border-primary/50"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
            /
          </kbd>
        </div>

        <div className="flex items-center gap-0.5">
          {POSITION_FILTERS.map((position) => (
            <button
              key={position}
              onClick={() => setPositionFilter(position)}
              className={cn(
                "px-1.5 py-1 rounded text-[10px] font-mono uppercase transition-colors",
                positionFilter === position
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              {position === "all" ? "ALL" : position}
            </button>
          ))}
        </div>

        {onMark && (
          <span className="hidden xl:inline font-mono text-[10px] text-muted-foreground/60">
            j k move · o out · m mine{onDraftHighlighted ? " · d draft" : ""} · ⌘Z undo
          </span>
        )}

        <button
          onClick={() => setHideCapped(!hideCapped)}
          title="ESPN's own draft room hides players your position caps rule out"
          className={cn(
            "ml-auto px-2 py-1 rounded text-[10px] font-mono uppercase transition-colors shrink-0",
            hideCapped
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted/50"
          )}
        >
          Hide capped{cappedCount > 0 && ` (${cappedCount})`}
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center border-b border-border/50 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-medium shrink-0">
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            onClick={() => toggleSort(col.key)}
            title={col.title}
            className={cn(
              "flex items-center justify-center gap-0.5 py-2 px-1 hover:bg-muted/50 transition-colors",
              col.width || "flex-1",
              sortKey === col.key && "text-foreground"
            )}
          >
            <span>{col.label}</span>
            <SortIcon
              active={sortKey === col.key}
              direction={sortKey === col.key ? sortDirection : undefined}
            />
          </button>
        ))}
        {onPick && <div className={cn("py-2 px-1 text-center", onDraftRow ? "w-36" : "w-24")}>Draft</div>}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <Table className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {rows.length === 0 ? message || "No players on the board yet" : "No players match this filter"}
            </p>
          </div>
        ) : (
          visible.map((row, index) => {
            const isActive = onMark !== undefined && row.player_id === activeId;
            const isKeeper = keeperIds?.has(row.player_id) ?? false;
            return (
              <div
                key={row.player_id}
                id={`draft-row-${row.player_id}`}
                onClick={() => setHighlight(row.player_id)}
                className={cn(
                  "flex items-center text-xs font-mono tabular-nums border-b border-border/30",
                  index % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                  onMark && "cursor-pointer",
                  isActive && "bg-primary/10 shadow-[inset_2px_0_0_hsl(var(--primary))]",
                  // Capped players stay visible so the user can see *why* they
                  // are unpickable — greyed, never hidden by default.
                  row.cap_blocked && "opacity-50"
                )}
              >
                <div className="w-10 py-1.5 px-1 text-center text-muted-foreground">
                  {row.cv_rank ?? "—"}
                </div>

                <div className="flex-[3] py-1.5 px-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate font-sans text-foreground">{row.name}</span>
                    {isKeeper && (
                      <span
                        title="One of your keepers — record it from the roster zone"
                        className="shrink-0 rounded border border-primary/40 bg-primary/10 px-1 text-[9px] uppercase text-primary"
                      >
                        Keep
                      </span>
                    )}
                    {pendingEspnId !== null && row.espn_id === pendingEspnId && (
                      <span
                        title="Sent to ESPN — waiting for its answer"
                        className="shrink-0 animate-pulse rounded border border-primary/40 bg-primary/10 px-1 text-[9px] uppercase text-primary"
                      >
                        Sending
                      </span>
                    )}
                    {row.cap_blocked && (
                      <span
                        title="Your league's position cap leaves no room for this player"
                        className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1 text-[9px] uppercase text-amber-500"
                      >
                        Cap
                      </span>
                    )}
                    {row.injury_status && (
                      <span
                        title={`Listed ${row.injury_status}`}
                        className="shrink-0 rounded border border-red-500/40 bg-red-500/10 px-1 text-[9px] uppercase text-red-500"
                      >
                        {row.injury_status.replace(/_/g, " ").slice(0, 3)}
                      </span>
                    )}
                    {row.value_source === "market" && (
                      <span
                        title="ESPN ranks him, but no projection or last-season line can value him yet"
                        className="shrink-0 rounded border border-border px-1 text-[9px] uppercase text-muted-foreground"
                      >
                        Mkt
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 truncate">
                    {[row.team, row.primary_position ?? row.position].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>

                <div
                  className={cn(
                    "w-16 py-1.5 px-1 text-center",
                    row.value !== null && "text-primary font-semibold"
                  )}
                >
                  {num(row.value)}
                </div>
                <div className="w-12 py-1.5 px-1 text-center text-muted-foreground">
                  {row.market_rank ?? "—"}
                </div>
                <div className="w-14 py-1.5 px-1 text-center text-muted-foreground">
                  {num(row.adp)}
                </div>
                <div
                  className={cn(
                    "w-12 py-1.5 px-1 text-center",
                    row.market_delta === null || row.market_delta === undefined
                      ? "text-muted-foreground"
                      : row.market_delta > 0
                        ? "text-green-500"
                        : row.market_delta < 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                  )}
                >
                  {row.market_delta === null || row.market_delta === undefined
                    ? "—"
                    : row.market_delta > 0
                      ? `+${row.market_delta}`
                      : row.market_delta}
                </div>
                <div className="w-12 py-1.5 px-1 text-center text-muted-foreground">
                  {row.projected_gp ?? row.last_season_gp ?? "—"}
                </div>

                {onPick && (
                  <div className={cn("py-1 px-1 flex items-center justify-center gap-1", onDraftRow ? "w-36" : "w-24")}>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPicking}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPick(row, false);
                      }}
                      title="Drafted by someone else (o)"
                      className="h-6 px-1.5 text-[10px]"
                    >
                      Out
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPicking || row.cap_blocked}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPick(row, true);
                      }}
                      title={
                        row.cap_blocked
                          ? "Your position caps leave no room for this player"
                          : "I drafted this player (m)"
                      }
                      className="h-6 px-1.5 text-[10px] text-primary hover:text-primary"
                    >
                      Mine
                    </Button>
                    {onDraftRow && (
                      <Button
                        size="sm"
                        variant={canDraft && !row.cap_blocked ? "default" : "ghost"}
                        disabled={!canDraft || row.cap_blocked}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDraftRow(row);
                        }}
                        title={
                          row.cap_blocked
                            ? "Your position caps leave no room for this player"
                            : canDraft
                              ? "Send this pick to ESPN (d)"
                              : (draftDisabledReason ?? undefined)
                        }
                        className="h-6 px-1.5 text-[10px]"
                      >
                        ESPN
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {meta && (
        <div className="flex items-center gap-3 px-2 py-1 border-t border-border/50 bg-muted/20 text-[10px] font-mono text-muted-foreground shrink-0">
          <span>
            {visible.length} of {meta.available} available
          </span>
          <span className="text-border">·</span>
          <span title="Rows valued from ESPN's published projections vs last season's baseline">
            {meta.projection_count} proj / {meta.baseline_count} base
            {meta.market_only_count > 0 && ` / ${meta.market_only_count} mkt`}
          </span>
          {meta.market_as_of && (
            <>
              <span className="text-border">·</span>
              <span>market {meta.market_as_of}</span>
            </>
          )}
          {meta.unsupported.length > 0 && (
            <>
              <span className="text-border">·</span>
              <span
                className="text-amber-500"
                title="League scoring keys the board cannot honor against aggregate lines"
              >
                ignores {meta.unsupported.join(", ")}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
