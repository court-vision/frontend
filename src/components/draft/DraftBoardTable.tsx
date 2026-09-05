"use client";

import { useEffect, useMemo, type KeyboardEvent, type RefObject } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Table } from "lucide-react";

import { cn } from "@/lib/utils";
import { columnsFor, countAtRisk, countCapped, sortableKey, type BoardColumn } from "@/lib/draft-board";
import { formatCategoryValue } from "@/lib/category-format";
import { useVisibleRows } from "@/hooks/useBoardView";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDraftRoomStore } from "@/stores/useDraftRoomStore";
import { POSITION_FILTERS } from "@/types/draft";
import type { DraftBoardMeta, DraftBoardRow, SortDirection } from "@/types/draft";

function SortIcon({ active, direction }: { active: boolean; direction?: SortDirection }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function num(value: number | null | undefined, decimals = 1): string {
  return value === null || value === undefined ? "—" : value.toFixed(decimals);
}

/**
 * The availability badge, per bucket. Raw Tailwind colours to match the Cap and
 * injury badges beside it, rather than the terminal's status tokens.
 */
const AVAILABILITY_BADGE: Record<
  NonNullable<DraftBoardRow["availability"]>,
  { label: string; className: string; title: string }
> = {
  likely: {
    label: "Likely",
    className: "border-green-500/40 bg-green-500/10 text-green-500",
    title: "Should still be there at your next pick",
  },
  tossup: {
    label: "Toss-up",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    title: "Might not last until your next pick",
  },
  gone: {
    label: "Gone",
    className: "border-red-500/40 text-red-500",
    title: "Very unlikely to last until your next pick",
  },
};

/**
 * The columns that stay put while the categories scroll. Keyed rather than
 * positional so the header and the body cells pin the same two.
 */
const STICKY: Partial<Record<string, string>> = {
  cv_rank: "sticky left-0",
  name: "sticky left-10",
};

/** Per-category z tint: a full standard deviation either way is worth marking. */
function zTint(z: number | undefined): string {
  if (z === undefined) return "";
  if (z >= 1) return "text-status-win";
  if (z <= -1) return "text-status-loss";
  return "text-muted-foreground";
}

/**
 * One body cell. The column decides its own width and alignment, so the header
 * and the row can never disagree about a column's size — they read the same
 * descriptor.
 *
 * Availability is the one column that renders *nothing* rather than an em dash
 * when it has no value. Every other column's dash means "no number"; an absent
 * availability means "no basis to say", and a bucket the user reads as a claim
 * must not be invented from silence.
 */
function Cell({ column, row }: { column: BoardColumn; row: DraftBoardRow }) {
  const base = cn(
    "py-1.5 px-1 shrink-0",
    column.className,
    column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left",
    column.punted && "opacity-40"
  );

  if (column.category) {
    const def = column.category;
    return (
      <div className={cn(base, "font-mono", zTint(row.category_z?.[def.key]))}>
        {formatCategoryValue(row.categories?.[def.key], def)}
      </div>
    );
  }

  switch (column.key) {
    case "cv_rank":
      return <div className={cn(base, "text-muted-foreground")}>{row.cv_rank ?? "—"}</div>;
    case "value":
      return (
        <div className={cn(base, row.value !== null && "text-primary font-semibold")}>
          {num(row.value)}
        </div>
      );
    case "fit_rank":
      return (
        <div
          title={
            row.fit_value === null
              ? undefined
              : `Fit rank ${row.fit_rank} — this player scored for your roster`
          }
          className={cn(base, row.fit_value !== null && "text-primary")}
        >
          {num(row.fit_value)}
        </div>
      );
    case "market_rank":
      return <div className={cn(base, "text-muted-foreground")}>{row.market_rank ?? "—"}</div>;
    case "adp":
      return <div className={cn(base, "text-muted-foreground")}>{num(row.adp)}</div>;
    case "market_delta": {
      const delta = row.market_delta;
      return (
        <div
          className={cn(
            base,
            delta === null || delta === undefined || delta === 0
              ? "text-muted-foreground"
              : delta > 0
                ? "text-green-500"
                : "text-red-500"
          )}
        >
          {delta === null || delta === undefined ? "—" : delta > 0 ? `+${delta}` : delta}
        </div>
      );
    }
    case "availability": {
      const badge = row.availability === null ? null : AVAILABILITY_BADGE[row.availability];
      return (
        <div className={base}>
          {badge && (
            <span
              title={badge.title}
              className={cn("rounded border px-1 text-[9px] uppercase", badge.className)}
            >
              {badge.label}
            </span>
          )}
        </div>
      );
    }
    case "projected_gp":
      return (
        <div className={cn(base, "text-muted-foreground")}>
          {row.projected_gp ?? row.last_season_gp ?? "—"}
        </div>
      );
    default:
      return null;   // `name` is rendered inline; it carries the badges.
  }
}

interface DraftBoardTableProps {
  rows: DraftBoardRow[];
  meta: DraftBoardMeta | null;
  message: string;
  isLoading: boolean;
  /** Omitted on a read-only board (the stateless pre-draft view). */
  onPick?: (row: DraftBoardRow, byMe: boolean) => void;
  /** Absent in a points league, where there is no fit column to sort by. */
  onSortByFit?: () => void;
  /** Absent unless this room is a mock the autopicker will play. */
  onSimulate?: () => void;
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
}

export function DraftBoardTable({
  rows,
  meta,
  message,
  isLoading,
  onPick,
  isPicking = false,
  onSortByFit,
  onSimulate,
  onMark,
  onMove,
  onUndoLast,
  inputRef,
  keeperIds,
}: DraftBoardTableProps) {
  const {
    sortKey,
    sortDirection,
    positionFilter,
    hideCapped,
    onlyLikelyGone,
    search,
    highlightId,
    toggleSort,
    setPositionFilter,
    setHideCapped,
    setOnlyLikelyGone,
    setSearch,
    setHighlight,
  } = useDraftRoomStore();

  // One definition of the columns, read by the header, the body and the sort.
  // A points league has no Fit and no categories, so the set follows the meta.
  const columns = useMemo(() => columnsFor(meta), [meta]);
  // The store remembers the last sort across rooms; a fit or category column
  // this league does not have would otherwise sort every row by a null.
  const activeSort = sortableKey(sortKey, columns);

  const visible = useVisibleRows(rows, meta);

  const cappedCount = useMemo(() => countCapped(rows), [rows]);
  const atRisk = useMemo(() => countAtRisk(rows), [rows]);
  // Driven off the same callbacks the keys are, so the legend cannot advertise
  // a key this room did not register.
  const legend = [
    "j k move",
    "o out",
    "m mine",
    onSortByFit ? "f fit" : null,
    onSimulate ? "s sim" : null,
    "⌘Z undo",
  ]
    .filter(Boolean)
    .join(" · ");

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
      onMark?.(e.shiftKey || e.metaKey || e.ctrlKey);
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
            placeholder={onMark ? "Type a name, ↵ out, ⇧↵ mine" : "Filter players..."}
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
            {legend}
          </span>
        )}

        {/* Only offered on a board that can answer it: without a slot or a
            market snapshot every row's availability is null, and the filter
            would empty the board rather than sharpen it. */}
        {atRisk > 0 && (
          <button
            onClick={() => setOnlyLikelyGone(!onlyLikelyGone)}
            title="Only players the market says will not last until your next pick"
            className={cn(
              "ml-auto shrink-0 px-1.5 py-1 rounded text-[10px] font-mono uppercase transition-colors",
              onlyLikelyGone
                ? "bg-red-500/15 text-red-500"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            Likely gone ({atRisk})
          </button>
        )}

        <button
          onClick={() => setHideCapped(!hideCapped)}
          title="ESPN's own draft room hides players your position caps rule out"
          className={cn(
            "px-2 py-1 rounded text-[10px] font-mono uppercase transition-colors shrink-0",
            atRisk === 0 && "ml-auto",
            hideCapped
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted/50"
          )}
        >
          Hide capped{cappedCount > 0 && ` (${cappedCount})`}
        </button>
      </div>

      {/* Header. A category league is wider than the pane, so the header and
          the rows share one horizontal scroller and the first two columns stay
          pinned — a board you cannot read the names on is not a board. */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
      <div className="sticky top-0 z-20 flex items-center border-b border-border/50 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {columns.map((col) => (
          <button
            key={col.key}
            onClick={() => toggleSort(col.key)}
            title={col.punted ? `${col.title ?? col.label} — punted, so it weighs nothing` : col.title}
            className={cn(
              "flex shrink-0 items-center justify-center gap-0.5 py-2 px-1 hover:bg-muted/50 transition-colors",
              col.className,
              STICKY[col.key] ?? "",
              STICKY[col.key] && "z-10 bg-muted/30",
              col.punted && "opacity-40",
              activeSort === col.key && "text-foreground"
            )}
          >
            <span className="truncate">{col.label}</span>
            <SortIcon
              active={activeSort === col.key}
              direction={activeSort === col.key ? sortDirection : undefined}
            />
          </button>
        ))}
        {onPick && <div className="w-24 shrink-0 py-2 px-1 text-center">Draft</div>}
      </div>

      {/* Rows */}
      <div>
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
            // The pinned cells need their own background, or the category
            // columns scroll underneath them. It has to be the row's own, so
            // the zebra and the highlight survive the pinning.
            const rowBg = isActive
              ? "bg-primary/10"
              : index % 2 === 0
                ? "bg-card"
                : "bg-muted/10";
            return (
              <div
                key={row.player_id}
                id={`draft-row-${row.player_id}`}
                onClick={() => setHighlight(row.player_id)}
                className={cn(
                  "flex items-center text-xs font-mono tabular-nums border-b border-border/30",
                  rowBg,
                  onMark && "cursor-pointer",
                  isActive && "shadow-[inset_2px_0_0_hsl(var(--primary))]",
                  // Capped players stay visible so the user can see *why* they
                  // are unpickable — greyed, never hidden by default.
                  row.cap_blocked && "opacity-50"
                )}
              >
                <div className={cn("w-10 shrink-0 py-1.5 px-1 text-center text-muted-foreground", STICKY.cv_rank, "z-10", rowBg)}>
                  {row.cv_rank ?? "—"}
                </div>

                <div className={cn("flex-[3] min-w-[180px] shrink-0 py-1.5 px-1", STICKY.name, "z-10", rowBg)}>
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

                {columns
                  .filter((col) => col.key !== "cv_rank" && col.key !== "name")
                  .map((col) => (
                    <Cell key={col.key} column={col} row={row} />
                  ))}

                {onPick && (
                  <div className="w-24 py-1 px-1 flex items-center justify-center gap-1">
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
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
        </div>
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
