"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { KIND_WORD, fitFlap, flapSteps, flapText, flapWidth, type RowButton } from "@/lib/daily-actions";
import type { DailyAction, DailyActionKind } from "@/types/daily-actions";
import { tip } from "./format";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

/** A row of today's moves and the button the desk gives it. */
export interface TodayRow {
  action: DailyAction;
  button: RowButton;
}

/** How the moves box is open: under the pointer (leaves with it), pinned by a click, or by the keyboard (takes focus). */
export type MovesOpen = "hover" | "pinned" | "keyboard" | null;

export interface TodayStripProps {
  status: "loading" | "error" | "ready";
  rows: TodayRow[];
  error: string | null;
  /** A muted line for the box's foot (the free-agent search failed, the rows are refreshing). */
  hint: string | null;
  /** "Tue 10/20": the day the moves are for. */
  dayLabel: string;
  open: MovesOpen;
  onOpen: (open: MovesOpen) => void;
  onButton: (row: TodayRow) => void;
  /** Stage every unstaged lineup row; null when fewer than two are left. */
  onStageAll: (() => void) | null;
  stageAllCount: number;
  onRetry: () => void;
  container: HTMLElement | null;
}

const CYCLE_MS = 4500;
const STEP_MS = 140;
const STAGGER_MS = 22;
const BOX_MIN_W = 560;
/** Narrowest box that may still start at the strip's left edge. */
const BOX_FIT_W = 440;

const TONE: Record<DailyActionKind, string> = {
  start: "var(--up)",
  ir_in: "var(--warn)",
  ir_out: "var(--warn)",
  add: "var(--accent)",
  add_drop: "var(--accent)",
};

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

/**
 * Today's moves, one at a time on a split-flap board in the week's tape, with
 * the shown move's Stage button beside it. Hovering (or D, or a click) opens
 * the whole list in a box that grows out of the strip: every row with its own
 * Stage button. Nothing here sends: lineup moves wait in the tray, an add in
 * the dock.
 */
export function TodayStrip(props: TodayStripProps) {
  const { status, rows, error, open, onOpen, onButton, container } = props;
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [strip, setStrip] = useState<HTMLDivElement | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const at = rows.length ? picked % rows.length : 0;
  const current = status === "ready" ? rows[at] ?? null : null;

  // One move after another while nobody is looking closer (and motion is welcome).
  useEffect(() => {
    if (rows.length < 2 || open || hovering || reduced) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setPicked((i) => i + 1);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [rows.length, open, hovering, reduced]);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = closeTimer.current = null;
  };
  useEffect(() => clearTimers, []);

  const hoverIn = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    setHovering(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    if (!open && !openTimer.current) openTimer.current = setTimeout(() => {
      openTimer.current = null;
      onOpen("hover");
    }, 140);
  };
  const hoverOut = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    setHovering(false);
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
    if (open === "hover") closeTimer.current = setTimeout(() => onOpen(null), 200);
  };

  const lines = rows.map((r) => flapText(r.action));
  const width = flapWidth(lines);
  const line =
    status === "loading" ? "READING ESPN" : status === "error" ? "UNAVAILABLE" : current ? lines[at] : "ALL SET";
  const tone = current ? TONE[current.action.kind] : status === "ready" ? "var(--up)" : "var(--text-3)";
  // The verb (or the whole line when it's a status) wears the move's colour.
  const toned = current ? toneLength(current.action.kind, lines[at]) : line.length;

  return (
    <>
      <div
        ref={setStrip}
        className={`${s.tick} ${s.todayTick}`}
        data-today
        data-open={open ? true : undefined}
        onPointerEnter={hoverIn}
        onPointerLeave={hoverOut}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          onOpen(open && open !== "hover" ? null : "pinned");
        }}
      >
        <span className={s.todayHead}>
          <span className={dk.label}>Today&apos;s moves</span>
          {rows.length > 1 && status === "ready" ? (
            <button type="button" className={s.todayCount} onClick={() => setPicked(at + 1)} title="Next move" aria-label={`Move ${at + 1} of ${rows.length}; show the next`}>
              {at + 1}/{rows.length}
            </button>
          ) : null}
          <button
            type="button"
            className={s.todayExpand}
            onClick={() => onOpen(open && open !== "hover" ? null : "keyboard")}
            aria-expanded={!!open}
            aria-label="All of today's moves"
            title="All of today's moves (D)"
          >
            <ChevronDown size={12} />
            <span className={dk.kbd}>D</span>
          </button>
        </span>
        <span className={s.todayLine} title={current ? [current.action.title, current.action.detail].filter(Boolean).join(" · ") : error ?? undefined}>
          <SplitFlap chars={fitFlap(line, width)} tone={tone} toned={toned} still={reduced} />
          <span className={s.srOnly} aria-live="off">
            {current ? current.action.title : line}
          </span>
          {current ? <StageButton row={current} onButton={onButton} /> : null}
        </span>
      </div>
      {open && container ? (
        <MovesBox
          {...props}
          at={at}
          onPick={setPicked}
          anchor={strip}
          reduced={reduced}
          hoverIn={() => {
            if (closeTimer.current) clearTimeout(closeTimer.current);
            closeTimer.current = null;
          }}
          hoverOut={() => {
            if (open === "hover") closeTimer.current = setTimeout(() => onOpen(null), 220);
          }}
        />
      ) : null}
    </>
  );
}

/** Cells that wear the move's colour: the verb, the pickup's name in a swap, or the whole IR line. */
function toneLength(kind: DailyActionKind, line: string): number {
  if (kind === "start") return "START".length;
  if (kind === "add") return "ADD".length;
  if (kind === "add_drop") return line.startsWith("ADD ") ? 3 : Math.max(0, line.indexOf(" FOR "));
  return line.length;
}

function StageButton({ row, onButton, wide = false }: { row: TodayRow; onButton: (row: TodayRow) => void; wide?: boolean }) {
  const b = row.button;
  const staged = b.intent === "unstage";
  return (
    <button
      type="button"
      className={`${dk.btn} ${dk.btnSmall} ${staged ? dk.toggleOn : ""} ${s.todayStage}`}
      style={wide ? { minWidth: 84, justifyContent: "center" } : undefined}
      disabled={b.disabled}
      aria-pressed={b.intent === "none" ? undefined : staged}
      title={b.reason ?? (staged ? "Staged: press to take it back" : row.action.kind === "add" || row.action.kind === "add_drop" ? "Put the pickup in the dock to review and send" : "Stage the moves; they wait in the tray until you send them")}
      onClick={() => onButton(row)}
    >
      {staged ? <Check size={12} /> : null}
      {b.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

function SplitFlap({ chars, tone, toned, still }: { chars: string[]; tone: string; toned: number; still: boolean }) {
  return (
    <span className={s.flaps} aria-hidden style={{ ["--flap-ink" as string]: tone }}>
      {chars.map((c, i) => (
        <Flap key={i} face={c} delay={i * STAGGER_MS} still={still} toned={i < toned} />
      ))}
    </span>
  );
}

/**
 * One flap. A new face turns the drum through a couple of faces on the way,
 * like the real boards: each step folds the old top half down over the new
 * one, then drops the new bottom half into place.
 */
function Flap({ face, delay, still, toned }: { face: string; delay: number; still: boolean; toned: boolean }) {
  const [state, setState] = useState({ cur: face, prev: face, n: 0 });
  const shown = useRef(face);
  useEffect(() => {
    if (still) return;
    const steps = flapSteps(shown.current, face);
    if (!steps.length) return;
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      const next = steps[i++];
      const prev = shown.current;
      shown.current = next;
      setState((st) => ({ cur: next, prev, n: st.n + 1 }));
      if (i < steps.length) t = setTimeout(step, STEP_MS);
    };
    t = setTimeout(step, delay);
    return () => clearTimeout(t);
  }, [face, delay, still]);
  const { cur, prev, n } = still ? { cur: face, prev: face, n: 0 } : state;
  return (
    <span className={`${s.flap} ${toned ? s.flapToned : ""}`}>
      <span className={s.flapTop}>
        <span>{cur}</span>
      </span>
      <span className={s.flapBottom}>
        <span>{n > 0 ? prev : cur}</span>
      </span>
      {n > 0 ? (
        <>
          <span key={`f${n}`} className={`${s.flapTop} ${s.flapFold}`}>
            <span>{prev}</span>
          </span>
          <span key={`d${n}`} className={`${s.flapBottom} ${s.flapDrop}`}>
            <span>{cur}</span>
          </span>
        </>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The box: every move, grown out of the strip
// ---------------------------------------------------------------------------

interface BoxProps extends TodayStripProps {
  at: number;
  onPick: (i: number) => void;
  anchor: HTMLElement | null;
  reduced: boolean;
  hoverIn: () => void;
  hoverOut: () => void;
}

function MovesBox({ status, rows, error, hint, dayLabel, open, onOpen, onButton, onStageAll, stageAllCount, onRetry, container, at, onPick, anchor, reduced, hoverIn, hoverOut }: BoxProps) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; width: number } | null>(null);

  const measure = useCallback(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    // Over the strip from its left edge, as wide as the window lets it be; when
    // that leaves too little room, from the strip's right edge instead.
    const room = vw - 16 - r.left;
    const width = room >= BOX_FIT_W ? Math.max(r.width, Math.min(BOX_MIN_W, room)) : Math.min(Math.max(r.width, BOX_MIN_W), vw - 32);
    const left = room >= BOX_FIT_W ? r.left : Math.max(16, r.right - width);
    setPlace({ left, top: r.top, width });
  }, [anchor]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Grow out of the strip: the clip starts at the strip's own rectangle.
  const grown = useRef(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !place || !anchor || grown.current) return;
    grown.current = true;
    if (reduced || typeof el.animate !== "function") return;
    const r = anchor.getBoundingClientRect();
    const right = Math.max(0, place.width - (r.right - place.left));
    const bottom = Math.max(0, el.offsetHeight - r.height);
    el.animate(
      [{ clipPath: `inset(0px ${right}px ${bottom}px ${Math.max(0, r.left - place.left)}px round 6px)` }, { clipPath: "inset(0px 0px 0px 0px round 8px)" }],
      { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  }, [place, anchor, reduced]);

  // Opened from the keyboard: focus goes to the first button that can act.
  useEffect(() => {
    if (open !== "keyboard" || !place) return;
    const el = box.current;
    (el?.querySelector<HTMLButtonElement>("[data-row] button:not(:disabled)") ?? el?.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus();
  }, [open, place]);

  // Pinned open: a press anywhere else closes it.
  useEffect(() => {
    if (open === "hover") return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || anchor?.contains(t)) return;
      onOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, anchor, onOpen]);

  if (!place) return null;
  const lineupLeft = stageAllCount;
  return createPortal(
    <div
      ref={box}
      className={s.todayBox}
      style={{ left: place.left, top: place.top, width: place.width }}
      data-today
      role="region"
      aria-label="Today's moves"
      onPointerEnter={(e) => e.pointerType === "mouse" && hoverIn()}
      onPointerLeave={(e) => e.pointerType === "mouse" && hoverOut()}
      onPointerDown={() => open === "hover" && onOpen("pinned")}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onOpen(null);
          anchor?.querySelector<HTMLButtonElement>("[aria-expanded]")?.focus();
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const buttons = [...(box.current?.querySelectorAll<HTMLButtonElement>("[data-row] button") ?? [])];
          const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = buttons[Math.max(0, Math.min(buttons.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
          if (next) {
            e.preventDefault();
            next.focus();
          }
        }
      }}
    >
      <div className={s.todayBoxHead}>
        <span className={dk.label}>Today&apos;s moves</span>
        <span className={dk.sub}>
          {dayLabel}
          {status === "ready" ? ` · ${rows.length ? `${rows.length} move${rows.length === 1 ? "" : "s"}` : "nothing to do"}` : ""}
        </span>
        <span className={dk.grow} />
        <span className={dk.kbd}>D</span>
        <button type="button" className={dk.iconBtn} style={{ width: 24, height: 24 }} onClick={() => onOpen(null)} aria-label="Close today's moves">
          <X size={13} />
        </button>
      </div>
      {status === "loading" ? (
        <div className={s.todayEmpty}>Reading today&apos;s board and the free agents…</div>
      ) : status === "error" ? (
        <div className={s.todayEmpty}>
          <span>{error ?? "Couldn't work out today's moves."}</span>
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className={s.todayEmpty}>Nothing to do: everyone who plays today starts, IR is in order, and no free agent beats your idle players.</div>
      ) : (
        <div className={s.todayList}>
          {rows.map((r, i) => {
            const a = r.action;
            return (
              <div key={a.id} data-row className={`${s.todayRow} ${i === at ? s.todayRowOn : ""}`} onPointerEnter={() => onPick(i)} onFocus={() => onPick(i)}>
                <span className={s.todayKind} style={{ color: TONE[a.kind] }}>
                  {KIND_WORD[a.kind]}
                </span>
                <Headshot nbaId={a.player.nba_player_id} name={a.player.name} size={26} />
                <span className={s.todayText}>
                  <span className={s.todayTitle}>{a.title}</span>
                  {a.detail || r.button.reason ? <span className={s.todayDetail}>{r.button.reason && r.button.disabled ? r.button.reason : a.detail}</span> : null}
                </span>
                <span className={s.todayTip}>{tip(a.game_time_et)}</span>
                <StageButton row={r} onButton={onButton} wide />
              </div>
            );
          })}
        </div>
      )}
      <div className={s.todayFoot}>
        {onStageAll ? (
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onStageAll}>
            Stage all {lineupLeft} lineup moves
          </button>
        ) : null}
        <span className={s.note} title="Nothing is sent from here: staged lineup moves wait in the tray, a staged add in the dock.">
          {hint ?? "Staged moves wait in the tray, adds in the dock."}
        </span>
      </div>
    </div>,
    container!
  );
}
