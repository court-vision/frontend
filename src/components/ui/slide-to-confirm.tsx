"use client";

import * as React from "react";
import { Check, ChevronsRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface SlideToConfirmProps {
  /** Resting label, e.g. "Slide to apply on ESPN". Also the accessible name. */
  label: string;
  /** Label once the knob is past the threshold. */
  releaseLabel?: string;
  /** Label while `pending`. */
  pendingLabel?: string;
  onConfirm: () => void;
  /** The action is in flight: the knob stays at the end with a spinner. */
  pending?: boolean;
  disabled?: boolean;
  variant?: "default" | "destructive";
  className?: string;
}

/** Fraction of the travel the knob must cover before release confirms. */
const THRESHOLD = 0.88;
const KNOB = 40;
const PAD = 4;
const SPRING = "cubic-bezier(0.2, 0.9, 0.3, 1.15)";

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Slide-to-confirm for an irreversible write. The knob is dragged across the
 * track (pointer or touch); the fill follows it, the track turns solid once
 * the knob is past the threshold, and releasing there fires `onConfirm`.
 * Releasing early springs the knob back. Keyboard: arrows move the knob,
 * End confirms, Home resets. A send that fails hands the control back: the
 * knob returns to the start when `pending` drops without the surface closing.
 */
export function SlideToConfirm({
  label,
  releaseLabel = "Release to confirm",
  pendingLabel = "Sending…",
  onConfirm,
  pending = false,
  disabled = false,
  variant = "default",
  className,
}: SlideToConfirmProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  // The latest value, readable inside the same event turn: a fast drag can
  // move and release before React re-renders, and the release must judge
  // the position it actually reached, not the one last painted.
  const progressRef = React.useRef(0);
  const [dragging, setDragging] = React.useState(false);
  const draggingRef = React.useRef(false);
  const [done, setDone] = React.useState(false);
  const start = React.useRef({ x: 0, progress: 0 });
  const armed = React.useRef(false);
  const reduceMotion = React.useRef(false);

  React.useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => ro.disconnect();
  }, []);

  const wasPending = React.useRef(pending);
  React.useEffect(() => {
    if (wasPending.current && !pending) {
      setDone(false);
      progressRef.current = 0;
      setProgress(0);
      armed.current = false;
    }
    wasPending.current = pending;
  }, [pending]);

  const travel = Math.max(0, width - KNOB - PAD * 2);
  const inactive = disabled || pending || done;
  const past = progress >= THRESHOLD;

  const confirm = React.useCallback(() => {
    setDone(true);
    progressRef.current = 1;
    setProgress(1);
    armed.current = false;
    vibrate(20);
    onConfirm();
  }, [onConfirm]);

  const setP = (p: number) => {
    const next = clamp(p, 0, 1);
    const nowPast = next >= THRESHOLD;
    if (nowPast !== armed.current) {
      armed.current = nowPast;
      if (nowPast) vibrate(10);
    }
    progressRef.current = next;
    setProgress(next);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inactive) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety; the window listeners below finish the drag */
    }
    start.current = { x: e.clientX, progress: progressRef.current };
    draggingRef.current = true;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !travel) return;
    setP(start.current.progress + (e.clientX - start.current.x) / travel);
  };
  const onPointerEnd = React.useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (progressRef.current >= THRESHOLD) confirm();
    else {
      progressRef.current = 0;
      setProgress(0);
      armed.current = false;
    }
  }, [confirm]);

  // The drag ends wherever the pointer is let go — off the knob, off the
  // track, outside the window — so the release is heard at the window too.
  React.useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      if (!draggingRef.current || !travel) return;
      setP(start.current.progress + (e.clientX - start.current.x) / travel);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("blur", onPointerEnd);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("blur", onPointerEnd);
    };
  }, [dragging, travel, onPointerEnd]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (inactive) return;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp": {
        e.preventDefault();
        const next = clamp(progressRef.current + 0.1, 0, 1);
        if (next >= 1) confirm();
        else setP(next);
        break;
      }
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        setP(progressRef.current - 0.1);
        break;
      case "Home":
        e.preventDefault();
        setP(0);
        break;
      case "End":
        e.preventDefault();
        confirm();
        break;
    }
  };

  const tone =
    variant === "destructive"
      ? { fill: "bg-status-loss", soft: "bg-status-loss/20", knob: "bg-status-loss text-background", on: "text-background" }
      : { fill: "bg-primary", soft: "bg-primary/20", knob: "bg-primary text-primary-foreground", on: "text-primary-foreground" };

  const solid = past || pending || done;
  const ease = reduceMotion.current || dragging ? "none" : undefined;
  const x = progress * travel;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={inactive ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuetext={pending ? pendingLabel : past ? releaseLabel : label}
      aria-disabled={inactive || undefined}
      data-vaul-no-drag=""
      onKeyDown={onKeyDown}
      className={cn(
        "relative h-12 w-full select-none touch-none overflow-hidden rounded-full border border-border bg-muted/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        disabled && "opacity-50",
        className
      )}
    >
      {/* Fill: trails the knob, then floods the track once armed. */}
      <div
        className={cn("absolute inset-y-0 left-0 rounded-full", solid ? tone.fill : tone.soft)}
        style={{
          width: solid ? "100%" : `${PAD * 2 + KNOB + x}px`,
          transition: ease ?? `width 280ms ${SPRING}, background-color 160ms ease-out`,
        }}
      />

      <span
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center pl-10 text-sm font-medium",
          solid ? tone.on : "text-muted-foreground"
        )}
        style={{
          opacity: solid ? 1 : clamp(1 - progress * 1.8, 0, 1),
          transition: ease ?? "opacity 120ms linear",
        }}
      >
        {pending ? pendingLabel : solid ? releaseLabel : label}
      </span>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className={cn(
          "absolute left-1 top-1 flex h-10 w-10 items-center justify-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
          tone.knob,
          !inactive && "cursor-grab active:cursor-grabbing",
          dragging && "scale-105"
        )}
        style={{
          transform: `translateX(${x}px)`,
          transition: ease ?? `transform 320ms ${SPRING}`,
        }}
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : solid ? (
          <Check className="h-5 w-5" />
        ) : (
          <ChevronsRight className="h-5 w-5" />
        )}
      </div>
    </div>
  );
}
