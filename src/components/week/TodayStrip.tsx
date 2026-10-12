"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { KIND_WORD, fitFlap, flapSteps, flapText, flapWidth, type RowButton } from "@/lib/daily-actions";
import type { DailyAction, DailyActionKind } from "@/types/daily-actions";
import { tip } from "./format";
import { TickBox, useReducedMotion, useTickHover, type TickOpen } from "./TickBox";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

/** A row of today's moves and the button the desk gives it. */
export interface TodayRow {
  action: DailyAction;
  button: RowButton;
}


export interface TodayStripProps {
  status: "loading" | "error" | "ready";
  rows: TodayRow[];
  error: string | null;
  /** A muted line for the box's foot (the free-agent search failed, the rows are refreshing). */
  hint: string | null;
  /** "Tue 10/20": the day the moves are for. */
  dayLabel: string;
  open: TickOpen;
  onOpen: (open: TickOpen) => void;
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

const TONE: Record<DailyActionKind, string> = {
  start: "var(--up)",
  ir_in: "var(--warn)",
  ir_out: "var(--warn)",
  add: "var(--accent)",
  add_drop: "var(--accent)",
};

/**
 * Today's moves, one at a time on a split-flap board in the week's tape, with
 * the shown move's Stage button beside it. Hovering (or D, or a click) opens
 * the whole list in a box that grows out of the strip: every row with its own
 * Stage button. Nothing here sends: lineup moves wait in the tray, an add in
 * the dock.
 */
export function TodayStrip(props: TodayStripProps) {
  const { status, rows, error, open, onOpen, onButton } = props;
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState(0);
  const [strip, setStrip] = useState<HTMLDivElement | null>(null);
  const hover = useTickHover(open, onOpen);
  const at = rows.length ? picked % rows.length : 0;
  const current = status === "ready" ? rows[at] ?? null : null;

  // One move after another while nobody is looking closer (and motion is welcome).
  useEffect(() => {
    if (rows.length < 2 || open || hover.hovering || reduced) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setPicked((i) => i + 1);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [rows.length, open, hover.hovering, reduced]);

  const lines = rows.map((r) => flapText(r.action));
  const width = flapWidth(lines);
  const line =
    status === "loading" ? "READING ESPN" : status === "error" ? "UNAVAILABLE" : current ? lines[at] : "ALL SET";
  const tone = current ? TONE[current.action.kind] : status === "ready" ? "var(--up)" : "var(--text-3)";
  // The verb (or the whole line when it's a status) wears the move's colour.
  const toned = current ? toneLength(current.action.kind, lines[at]) : line.length;

  return (
    <>
      <div ref={setStrip} className={`${s.tick} ${s.todayTick}`} data-open={open ? true : undefined} {...hover.tick}>
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
      {open ? <MovesBox {...props} at={at} onPick={setPicked} anchor={strip} reduced={reduced} hover={hover.box} /> : null}
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
  hover: { onEnter: () => void; onLeave: () => void };
}

function MovesBox({ status, rows, error, hint, dayLabel, open, onOpen, onButton, onStageAll, stageAllCount, onRetry, container, at, onPick, anchor, reduced, hover }: BoxProps) {
  return (
    <TickBox
      anchor={anchor}
      container={container}
      open={open}
      onOpen={onOpen}
      hover={hover}
      reduced={reduced}
      label="Today's moves"
      keyHint="D"
      sub={`${dayLabel}${status === "ready" ? ` · ${rows.length ? `${rows.length} move${rows.length === 1 ? "" : "s"}` : "nothing to do"}` : ""}`}
      foot={
        <>
          {onStageAll ? (
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onStageAll}>
              Stage all {stageAllCount} lineup moves
            </button>
          ) : null}
          <span className={s.note} title="Nothing is sent from here: staged lineup moves wait in the tray, a staged add in the dock.">
            {hint ?? "Staged moves wait in the tray, adds in the dock."}
          </span>
        </>
      }
    >
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
    </TickBox>
  );
}
