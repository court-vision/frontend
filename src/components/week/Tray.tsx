"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { slotName, type MoveRole } from "@/lib/lineup-editor";
import type { LineupMove, MoveError } from "@/types/lineup-editor";
import { shortName, signed } from "./format";
import { SlideToSend } from "./SlideToSend";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

/** One day's staged moves and the problems they'd hit at ESPN. */
export interface PendingDay {
  day: number;
  label: string;
  moves: LineupMove[];
  problems: MoveError[];
}

export interface TrayMove {
  playerId: number;
  name: string;
  from: number;
  to: number;
  role: MoveRole;
}

export interface SwapTiming {
  /** null: made now. */
  day: number | null;
  label: string;
  delta: number;
}

/** The add / drop staged in a day's column: made now (today's column) or scheduled for that day. */
export interface TraySwap {
  add: { id: number; name: string; team: string; games: string };
  /**
   * Who is dropped; null for an add into an open roster spot. `staged`: a drop
   * staged on its own that the add rides on (it fills the spot he frees), which
   * its × takes back.
   */
  drop: { id: number; name: string; staged?: boolean } | null;
  /** The day it is scheduled for; null: made now. */
  from: number | null;
  /** When it could be made: now, or before one of his later game days, with what each does to the week. */
  timings: SwapTiming[];
  /** When the server makes a scheduled one, in words. */
  timing: string | null;
}

/** A day's column in the tray. */
export interface TrayDay {
  day: number;
  /** "Thu" */
  dow: string;
  /** "11/12" */
  date: string;
  moves: TrayMove[];
  /** Players dropped on their own, made now (today's column). */
  drops: Array<{ id: number; name: string }>;
  swap: TraySwap | null;
  /** What this day's moves add to the week. */
  delta: number;
  /** Why ESPN would refuse them as they stand: the day can't be confirmed. */
  problems: string[];
  /** Why the last send of this day failed. */
  error: string | null;
}

interface TrayProps {
  days: TrayDay[];
  /** Why nothing can be sent (the team's lineup writes are blocked). */
  blocked: string | null;
  /** The day being written right now. */
  sendingDay: number | null;
  onUnstage: (day: number, playerId: number) => void;
  /** Take a staged drop back. */
  onUndrop: (playerId: number) => void;
  onDiscardDay: (day: number) => void;
  onDiscardAll: () => void;
  /** Move the add / drop to another day (null: make it now). */
  onTiming: (day: number | null) => void;
  onCancelSwap: () => void;
  /** Send these days, in day order; resolves when done (or stopped at a refusal). */
  onSend: (days: number[]) => Promise<void>;
  /** The tray floats over the view: its height, so the view can scroll its last rows clear of it. */
  onHeight?: (px: number) => void;
}

/** A confirmation is of a day's moves as they stand: change them and it lapses. */
const keyOf = (d: TrayDay) =>
  `${d.day}:${d.moves.map((m) => `${m.playerId}>${m.to}`).join(",")}|${d.drops.map((x) => x.id).join(",")}|${d.swap ? `${d.swap.add.id}>${d.swap.drop?.id ?? 0}@${d.swap.from}` : ""}`;

/**
 * Everything staged for ESPN before it goes: one column per day, in day order,
 * with that day's lineup moves, the drops made now (today's column) and the
 * add / drop made that day (now, in today's column; or scheduled for it). A day is confirmed by ticking its
 * column, or by the slider passing under it; Send (or the slider reaching its
 * end) writes the confirmed days, earliest first, since each day's edit carries
 * into the days after it.
 */
export function Tray({ days, blocked, sendingDay, onUnstage, onUndrop, onDiscardDay, onDiscardAll, onTiming, onCancelSwap, onSend, onHeight }: TrayProps) {
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !onHeight) return;
    const ro = new ResizeObserver(() => onHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);
  const sending = sendingDay != null;
  const locked = sending || !!blocked;
  const sendable = useMemo(() => new Set(days.filter((d) => d.problems.length === 0).map((d) => d.day)), [days]);
  // Days ticked by hand (or kept from a slide let go of early), and days the slider has passed.
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [passed, setPassed] = useState<ReadonlySet<number>>(() => new Set());
  const confirmed = useMemo(
    () => new Set(days.filter((d) => sendable.has(d.day) && (picked.has(keyOf(d)) || passed.has(d.day))).map((d) => d.day)),
    [days, sendable, picked, passed]
  );
  const keep = (over: ReadonlySet<number>) =>
    setPicked((p) => new Set([...p, ...days.filter((d) => over.has(d.day)).map(keyOf)]));

  // Days that go out leave the tray; one that fails stays confirmed for a retry.
  const send = (list: number[]) => (list.length ? onSend(list) : Promise.resolve());
  const toggle = (d: TrayDay) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(keyOf(d))) next.delete(keyOf(d));
      else next.add(keyOf(d));
      return next;
    });

  // ---- the slider: passing under a day confirms it, the end sends ----
  const cols = useRef(new Map<number, HTMLElement>());
  const reveal = (day: number | undefined) =>
    day != null && cols.current.get(day)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  /** The thumb reached the end: everything it passed (and everything ticked) goes. */
  const finish = (over: ReadonlySet<number>) => {
    const list = days.filter((d) => sendable.has(d.day) && (picked.has(keyOf(d)) || over.has(d.day))).map((d) => d.day);
    keep(over);
    setPassed(new Set());
    return send(list);
  };
  /** Let go short of the end: the days passed stay confirmed. */
  const release = (over: ReadonlySet<number>) => {
    keep(over);
    setPassed(new Set());
  };

  const confirmedLabel = days.filter((d) => confirmed.has(d.day)).map((d) => d.dow);

  // Folded away to see the grid; everything staged (and ticked) stays.
  const [collapsed, setCollapsed] = useState(false);
  const moveCount = days.reduce((n, d) => n + d.moves.length, 0);
  const dropCount = days.reduce((n, d) => n + d.drops.length, 0);
  const swap = days.find((d) => d.swap)?.swap ?? null;
  const what = [
    moveCount ? `${moveCount} move${moveCount === 1 ? "" : "s"}` : "",
    dropCount ? `${dropCount} drop${dropCount === 1 ? "" : "s"}` : "",
    swap ? (swap.from != null ? "1 pickup" : swap.drop ? "1 add / drop" : "1 add") : "",
    `${days.length} day${days.length === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (collapsed) {
    return (
      <section ref={rootRef} className={s.tray} data-tray data-collapsed aria-label="Staged roster changes">
        <button type="button" className={s.trayFold} onClick={() => setCollapsed(false)} title="Open the tray">
          <ChevronUp size={14} />
          Staged · {what}
          {sending ? <span className={dk.spin} /> : null}
        </button>
        <span className={dk.sub}>{blocked ?? (confirmedLabel.length ? `${confirmedLabel.join(", ")} confirmed` : "")}</span>
      </section>
    );
  }

  return (
    <section ref={rootRef} className={s.tray} data-tray aria-label="Staged roster changes">
      <div className={s.trayCols} role="group" aria-label="Days with staged changes">
        {days.map((d) => {
          const ok = sendable.has(d.day);
          const on = confirmed.has(d.day);
          const sw = d.swap;
          const note = d.error ?? d.problems[0] ?? null;
          return (
            <div
              key={d.day}
              ref={(el) => {
                if (el) cols.current.set(d.day, el);
                else cols.current.delete(d.day);
              }}
              className={s.trayCol}
              data-confirmed={on}
              data-problem={!ok || !!d.error}
              data-sending={sendingDay === d.day}
              data-swap={!!sw}
            >
              <div className={s.trayColHead}>
                <button
                  type="button"
                  className={s.trayPick}
                  aria-pressed={on}
                  disabled={!ok || locked}
                  onClick={() => toggle(d)}
                  title={ok ? (on ? `Don't send ${d.dow}` : `Confirm ${d.dow}'s changes`) : "Fix this day's changes first"}
                >
                  <span className={s.trayCheck}>{on ? <Check size={11} strokeWidth={3} /> : null}</span>
                  <span className={s.trayDow}>{d.dow}</span>
                  <span className={dk.sub}>{d.date}</span>
                </button>
                <span className={`${dk.chip} ${d.delta > 0.05 ? dk.up : d.delta < -0.05 ? dk.down : dk.flat}`} title="Change to your week">
                  {signed(d.delta)}
                </span>
                <button
                  type="button"
                  className={s.trayX}
                  onClick={() => onDiscardDay(d.day)}
                  disabled={sending}
                  aria-label={`Discard ${d.dow}'s changes`}
                  title={`Discard ${d.dow}'s changes`}
                >
                  <X size={12} />
                </button>
              </div>
              <ul className={s.trayMoves}>
                {d.moves.map((m) => (
                  <li key={m.playerId} className={s.trayMove} data-role={m.role}>
                    <span className={s.trayMoveName} title={m.name}>
                      {shortName(m.name)}
                    </span>
                    <span className={s.trayMoveSlots}>
                      {slotName(m.from)}
                      <span className={s.arrow}>→</span>
                      <b>{slotName(m.to)}</b>
                    </span>
                    <button
                      type="button"
                      className={s.trayX}
                      onClick={() => onUnstage(d.day, m.playerId)}
                      disabled={sending}
                      aria-label={`Undo ${m.name}'s move`}
                      title="Undo this move (and its swap)"
                    >
                      <X size={11} />
                    </button>
                  </li>
                ))}
                {d.drops.map((x) => (
                  <li key={`drop-${x.id}`} className={s.trayMove} data-role="drop">
                    <span className={s.trayMoveName} title={x.name}>
                      <b className={s.traySign}>−</b> {shortName(x.name)}
                    </span>
                    <span className={s.trayMoveSlots}>drop</span>
                    <button
                      type="button"
                      className={s.trayX}
                      onClick={() => onUndrop(x.id)}
                      disabled={sending}
                      aria-label={`Keep ${x.name}`}
                      title="Keep him: take the drop back"
                    >
                      <X size={11} />
                    </button>
                  </li>
                ))}
                {sw ? (
                  <>
                    <li className={s.trayMove} data-role="add">
                      <span className={s.trayMoveName} title={sw.add.name}>
                        <b className={s.traySign}>+</b> {shortName(sw.add.name)}
                      </span>
                      <span className={s.trayMoveSlots} title={sw.add.games}>
                        {sw.add.team}
                      </span>
                      <button
                        type="button"
                        className={s.trayX}
                        onClick={onCancelSwap}
                        disabled={sending}
                        aria-label={`Take back the pickup of ${sw.add.name}`}
                        title="Take the pickup back"
                      >
                        <X size={11} />
                      </button>
                    </li>
                    <li className={s.trayMove} data-role="drop">
                      {sw.drop ? (
                        <span className={s.trayMoveName} title={sw.drop.name}>
                          <b className={s.traySign}>−</b> {shortName(sw.drop.name)}
                        </span>
                      ) : (
                        <span className={`${s.trayMoveName} ${dk.sub}`}>Into an open roster spot</span>
                      )}
                      <span className={s.trayMoveSlots}>{sw.drop ? "drop" : ""}</span>
                      {sw.drop?.staged ? (
                        <button
                          type="button"
                          className={s.trayX}
                          onClick={() => onUndrop(sw.drop!.id)}
                          disabled={sending}
                          aria-label={`Keep ${sw.drop.name}`}
                          title="Keep him: take the drop back (the add then needs another spot)"
                        >
                          <X size={11} />
                        </button>
                      ) : (
                        <span />
                      )}
                    </li>
                  </>
                ) : null}
              </ul>
              {sw && sw.timings.length > 1 ? (
                <div className={s.trayTimings} role="radiogroup" aria-label="When to make it">
                  {sw.timings.map((t) => (
                    <button
                      key={t.day ?? "now"}
                      type="button"
                      role="radio"
                      aria-checked={t.day === sw.from}
                      className={s.timing}
                      disabled={sending}
                      onClick={() => onTiming(t.day)}
                      title={t.day == null ? "Add him now" : `Schedule it for ${t.label}: the player you drop plays until then`}
                    >
                      {t.label}
                      <span className={s.timingDelta} data-sign={t.delta > 0.05 ? "up" : t.delta < -0.05 ? "down" : "flat"}>
                        {signed(t.delta)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {sendingDay === d.day ? (
                <div className={s.trayColNote}>
                  <span className={dk.spin} /> Sending…
                </div>
              ) : note ? (
                <div className={s.trayColNote} data-tone="down">
                  {note}
                </div>
              ) : sw?.timing ? (
                <div className={s.trayColNote} data-tone="hint" title={sw.timing}>
                  {sw.timing}
                </div>
              ) : d.drops.length || sw?.drop?.staged ? (
                <div className={s.trayColNote} data-tone="hint">
                  Dropped players go to waivers on ESPN
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <SlideToSend
        stops={days.map((d) => d.day)}
        anchorOf={(day) => cols.current.get(day)}
        locked={!!blocked}
        busy={sending}
        label={blocked ? blocked : "Slide to confirm each day, then send"}
        ariaLabel="Confirm days and send"
        valueNow={confirmed.size}
        valueMax={days.length + 1}
        valueText={confirmedLabel.length ? `${confirmedLabel.join(", ")} confirmed` : "No days confirmed"}
        onPass={(over, latest) => {
          setPassed(over);
          reveal(latest);
        }}
        onRelease={release}
        onFinish={finish}
      />
      <div className={s.trayActions}>
        <button
          type="button"
          className={`${dk.btn} ${dk.btnSmall} ${dk.btnPrimary}`}
          disabled={locked || confirmed.size === 0}
          onClick={() => void send([...confirmed])}
          title="Send the days ticked, earliest first: each day's edit carries into later days until one has its own"
        >
          {sending ? "Sending…" : confirmed.size === 0 ? "Send" : `Send ${confirmedLabel.join(", ")}`}
        </button>
        <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onDiscardAll} disabled={sending}>
          Discard all
        </button>
        <button
          type="button"
          className={dk.iconBtn}
          onClick={() => setCollapsed(true)}
          aria-label="Collapse the tray"
          title="Collapse the tray: everything stays staged"
        >
          <ChevronDown size={15} />
        </button>
      </div>
    </section>
  );
}
