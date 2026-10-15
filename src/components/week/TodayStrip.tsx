"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { KIND_WORD, moveLine, type RowButton } from "@/lib/daily-actions";
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
const STAGGER_MS = 45;
/** The new line starts rolling in once the old one is on its way out. */
const IN_AFTER_MS = 130;

const TONE: Record<DailyActionKind, string> = {
  start: "var(--up)",
  ir_in: "var(--warn)",
  ir_out: "var(--warn)",
  add: "var(--accent)",
  add_drop: "var(--accent)",
};

/**
 * Today's moves, one at a time in the week's tape, each new one rolling in
 * over the last, with the shown move's Stage button beside it. Resting on the
 * move itself (or D, or a click on it) opens the whole list in a box that
 * grows out of the strip: every row with its own Stage button. The Stage
 * button and the strip's edges never open it, so the button stays reachable,
 * and the moves hold still while the pointer is anywhere on the strip. Nothing
 * here sends: everything waits in the tray.
 */
export function TodayStrip(props: TodayStripProps) {
  const { status, rows, error, open, onOpen, onButton } = props;
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState(0);
  const [strip, setStrip] = useState<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  const hover = useTickHover(open, onOpen);
  const at = rows.length ? picked % rows.length : 0;
  const current = status === "ready" ? rows[at] ?? null : null;

  // One move after another while nobody is looking closer (and motion is welcome).
  useEffect(() => {
    if (rows.length < 2 || open || near || hover.hovering || reduced) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setPicked((i) => i + 1);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [rows.length, open, near, hover.hovering, reduced]);

  const lines = rows.map((r) => moveLine(r.action));
  const line =
    status === "loading" ? "Reading ESPN" : status === "error" ? "Unavailable" : current ? lines[at] : "All set";
  const tone = current ? TONE[current.action.kind] : status === "ready" ? "var(--up)" : "var(--text-3)";
  // The verb (or the whole line when it's a status) wears the move's colour.
  const toned = current ? toneLength(current.action.kind, lines[at]) : line.length;
  // Only the move itself opens the box: hovering it, or a click on it.
  const opens = hover.tick;

  return (
    <>
      <div
        ref={setStrip}
        className={`${s.tick} ${s.todayTick}`}
        data-open={open ? true : undefined}
        onPointerEnter={() => setNear(true)}
        onPointerLeave={() => setNear(false)}
      >
        <span className={s.todayHead}>
          <span className={`${dk.label} ${s.todayOpens}`} {...opens}>
            Today&apos;s moves
          </span>
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
        <span className={s.todayLine}>
          <span
            className={`${s.todayMove} ${s.todayOpens}`}
            title={current ? [current.action.title, current.action.detail].filter(Boolean).join(" · ") : error ?? undefined}
            {...opens}
          >
            <FlipLine text={line} tone={tone} toned={toned} lines={lines} still={reduced} />
            <span className={s.srOnly} aria-live="off">
              {current ? current.action.title : line}
            </span>
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
  if (kind === "start") return "Start".length;
  if (kind === "add") return "Add".length;
  if (kind === "add_drop") return line.startsWith("Add ") ? 3 : Math.max(0, line.indexOf(" for "));
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
      title={b.reason ?? (staged ? "Staged: press to take it back" : row.action.kind === "add" || row.action.kind === "add_drop" ? "Stage the pickup; it waits in the tray until you send it" : "Stage the moves; they wait in the tray until you send them")}
      onClick={() => onButton(row)}
    >
      {staged ? <Check size={12} /> : null}
      {b.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// The line
// ---------------------------------------------------------------------------

interface Face {
  text: string;
  tone: string;
  toned: number;
}

/**
 * The shown move. A new one rolls in from below as the old one rolls up and
 * away, word by word, like a drum turning over. Every line the strip can show
 * sits invisibly underneath, so the line is always as wide as the longest and
 * the Stage button never moves.
 */
function FlipLine({ text, tone, toned, lines, still }: Face & { lines: string[]; still: boolean }) {
  const [state, setState] = useState<{ cur: Face; prev: Face | null; n: number }>({ cur: { text, tone, toned }, prev: null, n: 0 });
  if (state.cur.text !== text || state.cur.tone !== tone || state.cur.toned !== toned) {
    const changed = state.cur.text !== text;
    setState({ cur: { text, tone, toned }, prev: changed && !still ? state.cur : state.prev, n: changed ? state.n + 1 : state.n });
  }
  const { cur, prev, n } = state;
  const moving = n > 0 && !still;
  return (
    <span className={s.flip} aria-hidden>
      <span className={s.flipSizer}>
        {[...new Set([...lines, text])].map((l) => (
          <span key={l}>{l}</span>
        ))}
      </span>
      {moving && prev ? <FaceWords key={`o${n}`} face={prev} motion={s.flipOut} /> : null}
      <FaceWords key={`i${n}`} face={cur} motion={moving ? s.flipIn : undefined} after={IN_AFTER_MS} />
    </span>
  );
}

function FaceWords({ face, motion, after = 0 }: { face: Face; motion?: string; after?: number }) {
  let offset = 0;
  return (
    <span className={s.flipFace}>
      {face.text.split(" ").map((w, i) => {
        const toned = offset < face.toned;
        offset += w.length + 1;
        return (
          <span
            key={i}
            className={`${s.flipWord} ${motion ?? ""}`}
            style={{ color: toned ? face.tone : undefined, animationDelay: motion ? `${after + i * STAGGER_MS}ms` : undefined }}
          >
            {w}
          </span>
        );
      })}
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
          <span className={s.note} title="Nothing is sent from here: staged moves and adds wait in the tray.">
            {hint ?? "Staged moves wait in the tray."}
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
