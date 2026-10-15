"use client";

import { useRef, useState } from "react";
import { ChevronsRight } from "lucide-react";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

const THUMB = 44;

const last = <T,>(list: T[]): T | undefined => list[list.length - 1];

interface Track {
  left: number;
  /** The thumb's travel: at this offset it has reached the end. */
  end: number;
  /** Each stop's checkpoint, as a thumb offset: passing it confirms the stop. */
  points: Array<{ key: number; at: number }>;
}

interface SlideToSendProps {
  /** Checkpoints along the way, in order (the tray's days); none: one slide to the end. */
  stops?: number[];
  /** The element a stop's checkpoint sits under; stops fall back to even spacing when these don't line up. */
  anchorOf?: (key: number) => HTMLElement | undefined;
  /** Can't be slid (nothing to send, or sending is blocked). */
  locked: boolean;
  /** Sending right now: the thumb spins. */
  busy: boolean;
  label: string;
  ariaLabel: string;
  valueNow: number;
  valueMax: number;
  valueText: string;
  /** The stops passed changed mid-slide; `latest` is the furthest one passed. */
  onPass?: (over: ReadonlySet<number>, latest: number | undefined) => void;
  /** Let go short of the end, having passed these stops. */
  onRelease?: (over: ReadonlySet<number>) => void;
  /** The thumb reached the end; it stays there until this settles. */
  onFinish: (over: ReadonlySet<number>) => Promise<unknown> | void;
}

/**
 * Slide to confirm: drag the thumb (or arrow / End from the keyboard) to the far end
 * to send. Stops along the track confirm as the thumb passes them, so the tray can
 * confirm day by day; letting go early sends nothing.
 */
export function SlideToSend({
  stops = [],
  anchorOf,
  locked,
  busy,
  label,
  ariaLabel,
  valueNow,
  valueMax,
  valueText,
  onPass,
  onRelease,
  onFinish,
}: SlideToSendProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<(Track & { grab: number; fired: boolean }) | null>(null);
  const passed = useRef<ReadonlySet<number>>(new Set());
  const off = locked || busy;

  /** Where each stop's checkpoint sits: under its anchor, or evenly when the anchors don't line up. */
  const measure = (): Track | null => {
    const track = trackRef.current;
    if (!track) return null;
    const r = track.getBoundingClientRect();
    const end = Math.max(0, r.width - THUMB);
    let points = stops.map((key) => {
      const c = anchorOf?.(key)?.getBoundingClientRect();
      return { key, at: c ? c.left + c.width / 2 - r.left - THUMB / 2 : NaN };
    });
    const aligned = points.every((p, i) => Number.isFinite(p.at) && p.at > 0 && p.at < end - 8 && (i === 0 || p.at > points[i - 1].at));
    if (!aligned) points = stops.map((key, i) => ({ key, at: ((i + 1) / (stops.length + 1)) * end }));
    return { left: r.left, end, points };
  };

  /** Move the thumb to `at`, reporting the stops it has passed when they change. */
  const moveTo = (t: Track, at: number) => {
    const over = t.points.filter((p) => at >= p.at);
    setX(at);
    if (over.length !== passed.current.size) {
      passed.current = new Set(over.map((p) => p.key));
      onPass?.(passed.current, last(over)?.key);
    }
    return passed.current;
  };
  const finish = (over: ReadonlySet<number>) => {
    passed.current = new Set();
    void Promise.resolve(onFinish(over)).finally(() => setX(0));
  };
  const release = (over: ReadonlySet<number>) => {
    passed.current = new Set();
    onRelease?.(over);
    setX(0);
  };

  const step = (dir: 1 | -1 | "end" | "home") => {
    const t = measure();
    if (!t || off) return;
    let at: number;
    if (dir === "home") at = 0;
    else if (dir === "end") at = t.end;
    else if (dir === 1) at = t.points.find((p) => p.at > x + 0.5)?.at ?? t.end;
    else at = [...t.points].reverse().find((p) => p.at < x - 0.5)?.at ?? 0;
    const over = moveTo(t, at);
    if (at >= t.end) finish(over);
  };
  const letGo = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d && !d.fired) release(passed.current);
  };

  return (
    <div
      ref={trackRef}
      className={s.slide}
      data-dragging={dragging}
      data-locked={off}
      style={{ ["--fill" as string]: `${x + THUMB / 2}px` }}
    >
      <span className={s.slideFill} />
      <span className={s.slideLabel} style={{ opacity: Math.max(0, 1 - x / 140) }} title={label}>
        {label}
      </span>
      <span className={s.slideEnd}>SEND</span>
      <button
        type="button"
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={valueMax}
        aria-valuenow={valueNow}
        aria-valuetext={valueText}
        aria-disabled={off}
        className={s.slideThumb}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={(e) => {
          if (off) return;
          const t = measure();
          if (!t) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { ...t, grab: e.clientX - t.left - x, fired: false };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.fired) return;
          const at = Math.max(0, Math.min(d.end, e.clientX - d.left - d.grab));
          const over = moveTo(d, at);
          if (at >= d.end - 1) {
            d.fired = true;
            finish(over);
          }
        }}
        onPointerUp={letGo}
        onPointerCancel={letGo}
        onKeyDown={(e) => {
          const keys: Record<string, 1 | -1 | "end" | "home"> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, End: "end", Home: "home" };
          const dir = keys[e.key];
          if (dir == null) return;
          e.preventDefault();
          step(dir);
        }}
        onBlur={() => {
          if (!drag.current && x > 0 && !busy) release(passed.current);
        }}
      >
        {busy ? <span className={dk.spin} /> : <ChevronsRight size={16} />}
      </button>
    </div>
  );
}
