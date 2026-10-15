"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
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

/** A day's column in the tray. */
export interface TrayDay {
  day: number;
  /** "Thu" */
  dow: string;
  /** "11/12" */
  date: string;
  moves: TrayMove[];
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
  demo: boolean;
  /** The day being written right now. */
  sendingDay: number | null;
  onUnstage: (day: number, playerId: number) => void;
  onDiscardDay: (day: number) => void;
  onDiscardAll: () => void;
  /** Send these days' moves, in day order; resolves when done (or stopped at a refusal). */
  onSend: (days: number[]) => Promise<void>;
  /** The tray floats over the view: its height, so the view can scroll its last rows clear of it. */
  onHeight?: (px: number) => void;
}

/** A confirmation is of a day's moves as they stand: change them and it lapses. */
const keyOf = (d: TrayDay) => `${d.day}:${d.moves.map((m) => `${m.playerId}>${m.to}`).join(",")}`;

/**
 * Staged lineup moves before they go to ESPN: one column per day, in day order,
 * a row per move. A day is confirmed by ticking its column, or by the slider
 * passing under it; Send (or the slider reaching its end) writes the confirmed
 * days, earliest first, since each day's edit carries into the days after it.
 */
export function Tray({ days, blocked, demo, sendingDay, onUnstage, onDiscardDay, onDiscardAll, onSend, onHeight }: TrayProps) {
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
  const allPicked = sendable.size > 0 && days.every((d) => !sendable.has(d.day) || picked.has(keyOf(d)));
  const moveCount = days.reduce((n, d) => n + d.moves.length, 0);
  const total = days.reduce((n, d) => n + d.delta, 0);

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

  return (
    <section ref={rootRef} className={s.tray} data-tray aria-label="Staged lineup moves">
      <div className={s.trayHead}>
        <span className={dk.label}>ESPN lineup</span>
        <span className={dk.sub}>
          {moveCount} move{moveCount === 1 ? "" : "s"} · {days.length} day{days.length === 1 ? "" : "s"}
        </span>
        <span className={`${dk.chip} ${total > 0.05 ? dk.up : total < -0.05 ? dk.down : dk.flat}`} title="Change to your week">
          {signed(total)}
        </span>
        <span className={s.note}>
          {blocked ??
            (demo
              ? "Demo: sends apply here only"
              : "Each day's edit carries into later days until one has its own; days go in order")}
        </span>
        <button type="button" className={dk.btn} onClick={onDiscardAll} disabled={sending}>
          Discard all
        </button>
        <button
          type="button"
          className={dk.btn}
          disabled={locked || sendable.size === 0}
          onClick={() => setPicked(allPicked ? new Set() : new Set(days.filter((d) => sendable.has(d.day)).map(keyOf)))}
        >
          {allPicked ? "Clear" : "Select all"}
        </button>
        <button
          type="button"
          className={`${dk.btn} ${dk.btnPrimary}`}
          disabled={locked || confirmed.size === 0}
          onClick={() => void send([...confirmed])}
        >
          {sending ? "Sending…" : confirmed.size === 0 ? "Send" : `Send ${confirmedLabel.join(", ")}`}
        </button>
      </div>

      <div className={s.trayBody}>
        <div className={s.trayCols} role="group" aria-label="Days with staged moves">
          {days.map((d) => {
            const ok = sendable.has(d.day);
            const on = confirmed.has(d.day);
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
              >
                <div className={s.trayColHead}>
                  <button
                    type="button"
                    className={s.trayPick}
                    aria-pressed={on}
                    disabled={!ok || locked}
                    onClick={() => toggle(d)}
                    title={ok ? (on ? `Don't send ${d.dow}` : `Confirm ${d.dow}'s moves`) : "Fix this day's moves first"}
                  >
                    <span className={s.trayCheck}>{on ? <Check size={11} strokeWidth={3} /> : null}</span>
                    <span className={s.trayDow}>{d.dow}</span>
                    <span className={dk.sub}>{d.date}</span>
                  </button>
                  <span className={`${dk.chip} ${d.delta > 0.05 ? dk.up : d.delta < -0.05 ? dk.down : dk.flat}`}>
                    {signed(d.delta)}
                  </span>
                  <button
                    type="button"
                    className={s.trayX}
                    onClick={() => onDiscardDay(d.day)}
                    disabled={sending}
                    aria-label={`Discard ${d.dow}'s moves`}
                    title={`Discard ${d.dow}'s moves`}
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
                </ul>
                {sendingDay === d.day ? (
                  <div className={s.trayColNote}>
                    <span className={dk.spin} /> Sending…
                  </div>
                ) : note ? (
                  <div className={s.trayColNote} data-tone="down">
                    {note}
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
          label={blocked ? blocked : "Slide to confirm each day · send at the end"}
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
      </div>
    </section>
  );
}
