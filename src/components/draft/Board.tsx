"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { motion } from "motion/react";
import { ArrowDown, ArrowUp, ChevronDown, Search } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { useDeskPortal } from "@/components/desk/DeskFrame";
import dk from "@/components/desk/desk.module.css";
import {
  basisNote,
  columnsFor,
  countCapped,
  playoffDetail,
  playoffTone,
  playoffWeightLabel,
  type BoardColumn,
} from "@/lib/draft-board";
import { healthOf } from "@/lib/week-grid";
import { useBoardView } from "@/hooks/useBoardView";
import { useDraftRoomStore } from "@/stores/useDraftRoomStore";
import { POSITION_FILTERS, type BoardSource, type DraftBoardMeta, type DraftBoardRow } from "@/types/draft";
import { catValue, num, signed } from "./format";
import s from "./draft.module.css";

/** Each column's floor in px; the spare width is shared out so a wide board never strands a gap. */
const MIN: Record<string, number> = {
  value: 58,
  fit_rank: 46,
  cv_rank: 46,
  market_rank: 50,
  adp: 52,
  market_delta: 44,
  availability: 72,
  projected_gp: 40,
  playoff_games: 40,
};
const CAT_MIN = 46;

const AVAIL_LABEL = { likely: "likely", tossup: "50/50", gone: "gone" } as const;
const SOURCE_LABEL: Record<BoardSource, string> = { espn: "ESPN", cv: "CV", my_team: "Mine" };
const SOURCE_TITLE: Record<BoardSource, string> = {
  espn: "ESPN's published rank for this league's format — the order ESPN's own room shows",
  cv: "Court Vision's rankings over the full pool",
  my_team: "Court Vision's rankings for your roster: value over replacement under your punts — it moves with every pick",
};

export interface BoardActions {
  onMark: (row: DraftBoardRow, byMe: boolean) => void;
  /** Present only where the Draft Tap can send picks to ESPN. */
  onEspn?: (row: DraftBoardRow) => void;
  espnDisabled: string | null;
  marking: boolean;
  pendingEspnId: number | null;
}

interface ToolbarProps {
  meta: DraftBoardMeta | null;
  rows: DraftBoardRow[];
  visibleCount: number;
  search: string;
  onSearch: (v: string) => void;
  onSearchKey: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  atRisk: number;
}

export const BoardToolbar = forwardRef<HTMLInputElement, ToolbarProps>(function BoardToolbar(
  { meta, rows, visibleCount, search, onSearch, onSearchKey, atRisk },
  inputRef
) {
  const container = useDeskPortal();
  const { positionFilter, setPositionFilter, hideCapped, setHideCapped, onlyLikelyGone, setOnlyLikelyGone, boardSource, setBoardSource, playoffWeight, setPlayoffWeight } =
    useDraftRoomStore();
  const capped = useMemo(() => countCapped(rows), [rows]);
  const note = basisNote(meta);
  const playoffs = meta?.playoffs ?? null;
  const [poOpen, setPoOpen] = useState(false);
  const weight = playoffWeight ?? playoffs?.weight ?? null;
  return (
    <div className={s.toolbar}>
      <label className={s.search}>
        <Search size={14} className={s.searchIcon} />
        <input
          ref={inputRef}
          className={s.searchInput}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder="Find a player · ⏎ taken · ⇧⏎ mine"
          spellCheck={false}
          autoComplete="off"
          aria-label="Search the board"
        />
        <span className={`${dk.kbd} ${s.searchKey}`}>/</span>
      </label>
      <div className={dk.rail} role="radiogroup" aria-label="Position">
        {POSITION_FILTERS.map((p) => {
          const on = positionFilter === p;
          return (
            <button key={p} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} onClick={() => setPositionFilter(p)}>
              {on ? <motion.span layoutId="pos-pill" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
              <span className={dk.segLabel}>{p === "all" ? "ALL" : p}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={`${dk.btn} ${dk.btnSmall} ${onlyLikelyGone ? dk.toggleOn : ""}`}
        aria-pressed={onlyLikelyGone}
        onClick={() => setOnlyLikelyGone(!onlyLikelyGone)}
        title="Only players the market expects to be gone before your next pick"
      >
        At risk <span className={dk.sub}>{atRisk}</span>
      </button>
      {capped > 0 ? (
        <button
          type="button"
          className={`${dk.btn} ${dk.btnSmall} ${hideCapped ? dk.toggleOn : ""}`}
          aria-pressed={hideCapped}
          onClick={() => setHideCapped(!hideCapped)}
          title="Hide players a position cap rules out"
        >
          Hide capped <span className={dk.sub}>{capped}</span>
        </button>
      ) : null}
      <span className={dk.spacer} />
      <span className={dk.label} title={note?.title}>
        Board
      </span>
      <div className={dk.rail} role="radiogroup" aria-label="Whose rankings order the board">
        {(["espn", "cv", "my_team"] as const).map((src) => {
          const on = boardSource === src;
          return (
            <button key={src} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} onClick={() => setBoardSource(src)} title={SOURCE_TITLE[src]}>
              {on ? <motion.span layoutId="src-pill" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
              <span className={dk.segLabel}>{SOURCE_LABEL[src].toUpperCase()}</span>
            </button>
          );
        })}
      </div>
      <span className={dk.kbd}>B</span>
      {playoffs ? (
        <Popover.Root open={poOpen} onOpenChange={setPoOpen}>
          <Popover.Trigger asChild>
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} title={`How much a game in your fantasy playoffs (${playoffs.label}) counts in CV's value`}>
              PO {weight != null ? playoffWeightLabel(weight) : "—"}
              <ChevronDown size={12} className={dk.chev} />
            </button>
          </Popover.Trigger>
          <Popover.Portal container={container}>
            <Popover.Content className={dk.menu} align="end" sideOffset={6} style={{ width: 260 }}>
              <div className={dk.menuHead}>
                <span className={dk.menuTitle}>Playoff weight</span>
                <span className={dk.sub}>One playoff game ({playoffs.label}) counts as this many regular-season games in CV&apos;s value. ESPN&apos;s order never moves with it.</span>
              </div>
              <div className={dk.menuList}>
                {playoffs.weights.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={dk.menuItem}
                    onClick={() => {
                      setPlayoffWeight(w === playoffs.weight ? null : w);
                      setPoOpen(false);
                    }}
                  >
                    <span className={dk.grow}>{playoffWeightLabel(w)}</span>
                    {w === playoffs.weight ? <span className={dk.sub}>default</span> : null}
                    {w === weight ? <span style={{ color: "var(--accent)" }}>●</span> : <span style={{ width: 8 }} />}
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : null}
      <span className={s.count}>
        {visibleCount === rows.length ? `${rows.length} left` : `${visibleCount} of ${rows.length}`}
      </span>
    </div>
  );
});

function floorOf(c: BoardColumn): number {
  if (c.key === "board_rank") return 44;
  if (c.key === "name") return 200;
  return c.category ? CAT_MIN : MIN[c.key] ?? 50;
}

/** Numbers grow a little past their floor and no further; the player column takes the rest. */
function templateFor(columns: BoardColumn[]): string {
  return columns
    .map((c) => {
      if (c.key === "board_rank") return "44px";
      if (c.key === "name") return "minmax(200px, 1fr)";
      return `minmax(${floorOf(c)}px, ${Math.round(floorOf(c) * 1.45)}px)`;
    })
    .join(" ");
}

interface BoardTableProps extends BoardActions {
  meta: DraftBoardMeta | null;
  rows: DraftBoardRow[];
  visible: DraftBoardRow[];
  activeId: number | null;
  onActivate: (id: number) => void;
  keeperIds: ReadonlySet<number>;
  loading: boolean;
  message: string;
}

export function BoardTable({ meta, rows, visible, activeId, onActivate, keeperIds, loading, message, ...actions }: BoardTableProps) {
  const columns = useMemo(() => columnsFor(meta), [meta]);
  const view = useBoardView(meta);
  const toggleSort = useDraftRoomStore((st) => st.toggleSort);
  const template = templateFor(columns);
  // Below the floors' sum the board scrolls sideways rather than squeeze a column.
  const minWidth = columns.reduce((sum, c) => sum + floorOf(c), 0);
  const wrap = useRef<HTMLDivElement>(null);

  // Keep the active row in view as the keyboard moves it.
  useEffect(() => {
    if (activeId == null) return;
    const el = wrap.current?.querySelector<HTMLElement>(`[data-player="${activeId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  // Scale for the category heat: the strongest z on the board.
  const zMax = useMemo(() => {
    let m = 1.5;
    for (const r of rows) for (const z of Object.values(r.category_z ?? {})) m = Math.max(m, Math.abs(z));
    return Math.min(m, 3);
  }, [rows]);

  return (
    <div ref={wrap} className={s.boardWrap}>
      <div className={s.boardHead} style={{ gridTemplateColumns: template, minWidth }}>
        {columns.map((c) => {
          const sorted = view.sortKey === c.key;
          return (
            <button
              key={c.key}
              type="button"
              className={s.th}
              data-align={c.align}
              data-sorted={sorted}
              data-punted={c.punted ?? false}
              title={c.title}
              onClick={() => c.sortable && toggleSort(c.key)}
            >
              {c.label}
              {sorted ? view.sortDirection === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} /> : null}
            </button>
          );
        })}
      </div>
      {loading && rows.length === 0 ? (
        <SkeletonRows template={template} count={columns.length} minWidth={minWidth} />
      ) : visible.length === 0 ? (
        <div className={s.boardEmpty}>{rows.length === 0 ? message || "Nobody left on the board." : "No player matches this view."}</div>
      ) : (
        visible.map((row) => (
          <BoardRow
            key={row.player_id}
            row={row}
            meta={meta}
            columns={columns}
            template={template}
            minWidth={minWidth}
            active={row.player_id === activeId}
            keeper={keeperIds.has(row.player_id)}
            zMax={zMax}
            onActivate={onActivate}
            {...actions}
          />
        ))
      )}
    </div>
  );
}

function SkeletonRows({ template, count, minWidth }: { template: string; count: number; minWidth: number }) {
  return (
    <>
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} className={s.boardRow} style={{ gridTemplateColumns: template, minWidth, opacity: 1 - i * 0.06 }}>
          {Array.from({ length: count }, (_, j) => (
            <span key={j} style={{ padding: "0 10px" }}>
              <span className={dk.skel} style={{ display: "block" }} />
            </span>
          ))}
        </div>
      ))}
    </>
  );
}

interface RowProps extends BoardActions {
  row: DraftBoardRow;
  meta: DraftBoardMeta | null;
  columns: BoardColumn[];
  template: string;
  minWidth: number;
  active: boolean;
  keeper: boolean;
  zMax: number;
  onActivate: (id: number) => void;
}

function BoardRow({ row, meta, columns, template, minWidth, active, keeper, zMax, onActivate, onMark, onEspn, espnDisabled, marking, pendingEspnId }: RowProps) {
  const health = healthOf(row.injury_status ?? "");
  const pending = pendingEspnId != null && row.espn_id === pendingEspnId;
  return (
    <div
      className={s.boardRow}
      style={{ gridTemplateColumns: template, minWidth }}
      data-player={row.player_id}
      data-active={active}
      data-capped={row.cap_blocked}
      data-pending={pending}
      onMouseDown={() => onActivate(row.player_id)}
    >
      {health !== "ok" ? <span className={s.health} data-health={health} /> : null}
      {columns.map((c) => (
        <Cell key={c.key} column={c} row={row} meta={meta} keeper={keeper} zMax={zMax} />
      ))}
      <span className={s.actions}>
        <button type="button" className={`${s.act} ${s.actMine}`} disabled={marking || row.cap_blocked} onClick={() => onMark(row, true)} title={row.cap_blocked ? "Would break your position cap" : "Drafted by you (⇧⏎ or M)"}>
          Mine
        </button>
        <button type="button" className={s.act} disabled={marking} onClick={() => onMark(row, false)} title="Taken by someone else (⏎ or O)">
          Taken
        </button>
        {onEspn ? (
          <button type="button" className={`${s.act} ${s.actEspn}`} disabled={!!espnDisabled || pending} onClick={() => onEspn(row)} title={espnDisabled ?? "Draft him on ESPN (D)"}>
            {pending ? "…" : "ESPN"}
          </button>
        ) : null}
      </span>
    </div>
  );
}

function Cell({ column, row, meta, keeper, zMax }: { column: BoardColumn; row: DraftBoardRow; meta: DraftBoardMeta | null; keeper: boolean; zMax: number }) {
  const td = (content: React.ReactNode, extra?: string, title?: string) => (
    <span className={`${s.td} ${extra ?? ""}`} data-align={column.align} title={title}>
      {content}
    </span>
  );
  if (column.category) {
    const def = column.category;
    const z = row.category_z?.[def.key] ?? null;
    const strength = z == null ? 0 : Math.min(1, Math.abs(z) / zMax);
    const tone = z == null ? "transparent" : `color-mix(in srgb, var(${z >= 0 ? "--up" : "--down"}) ${Math.round(strength * 26)}%, transparent)`;
    return (
      <span className={`${s.td} ${s.cat}`} data-align="right" title={z != null ? `${def.label}: z ${signed(z, 2)}` : undefined} style={column.punted ? { opacity: 0.35 } : undefined}>
        <span className={s.catHeat} style={{ background: tone }} />
        <span className={s.catValue}>{catValue(row.categories?.[def.key], !!def.is_rate)}</span>
      </span>
    );
  }
  switch (column.key) {
    case "board_rank":
      return td(row.board_rank ?? "—", s.rank);
    case "name":
      return (
        <span className={s.player}>
          <Headshot nbaId={row.player_id} name={row.name} size={28} />
          <span className={s.playerText}>
            <span className={s.playerName}>{row.name}</span>
            <span className={s.playerMeta}>
              {row.team ?? "FA"} · {row.primary_position ?? row.position ?? "—"}
              {keeper ? <span className={`${s.tag} ${s.tagAccent}`}>KEEPER</span> : null}
              {row.cap_blocked ? <span className={`${s.tag} ${s.tagDown}`}>CAP</span> : null}
              {row.injury_status && healthOf(row.injury_status) !== "ok" ? (
                <span className={`${s.tag} ${healthOf(row.injury_status) === "out" ? s.tagDown : s.tagWarn}`}>{injuryShort(row.injury_status)}</span>
              ) : null}
              {row.value_source === "market" ? <span className={s.tag} title="No projection or stat line values him yet — a rookie, usually">NO STATS</span> : null}
              {row.value_season ? <span className={s.tag} title={`Valued on ${row.value_season}, his last full season`}>{row.value_season}</span> : null}
            </span>
          </span>
        </span>
      );
    case "value":
      return td(num(row.value), s.strong, meta?.value_kind === "cat_value" ? "Category value on the fantasy-points scale" : "Fantasy points per game under this league's scoring");
    case "fit_rank":
      return td(row.fit_rank ?? "—", undefined, row.fit_value != null ? `Fit value ${num(row.fit_value)}` : undefined);
    case "cv_rank":
      return td(row.cv_rank ?? "—");
    case "market_rank":
      return td(row.market_rank ?? "—");
    case "adp":
      return td(num(row.adp));
    case "market_delta":
      return td(row.market_delta == null ? "—" : signed(row.market_delta, 0), row.market_delta == null || row.market_delta === 0 ? undefined : row.market_delta > 0 ? s.pos : s.neg);
    case "availability":
      return td(
        row.availability ? (
          <span className={s.avail} data-avail={row.availability}>
            <span className={s.availDot} />
            {AVAIL_LABEL[row.availability]}
          </span>
        ) : (
          "—"
        ),
        undefined,
        row.availability ? "From his ADP against your next pick" : undefined
      );
    case "projected_gp":
      return td(row.projected_gp ?? row.last_season_gp ?? "—");
    case "playoff_games": {
      const tone = playoffTone(row.playoff_games, meta?.playoffs);
      return td(row.playoff_games ?? "—", tone === "high" ? s.pos : tone === "low" ? s.neg : undefined, playoffDetail(row, meta?.playoffs) ?? undefined);
    }
    default:
      return td("—");
  }
}

function injuryShort(status: string): string {
  const s = status.toUpperCase();
  if (s === "DAY_TO_DAY" || s === "DTD") return "DTD";
  if (s.startsWith("OUT")) return "OUT";
  if (s.includes("SUSP")) return "SUSP";
  return s.slice(0, 4);
}
