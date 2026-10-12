"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";
import { openTick, type TapeBox, type TapeTick, type TickOpen } from "./tape-box";

export type { TapeBox, TickOpen };

/** The open state and setter one tick sees, out of the tape's single box. */
export function tickOf(box: TapeBox, tick: TapeTick, set: (next: TapeBox | ((b: TapeBox) => TapeBox)) => void) {
  return {
    open: box?.tick === tick ? box.how : null,
    onOpen: (how: TickOpen) => set((b) => openTick(b, tick, how)),
  };
}

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

/**
 * Hover intent for a tick and its box: the box opens after a short rest on
 * the tick and, opened that way, closes a moment after the pointer has left
 * both (the box grows over the tick, so moving into it never closes it).
 */
export function useTickHover(open: TickOpen, onOpen: (open: TickOpen) => void) {
  const [hovering, setHovering] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = (t: typeof openTimer) => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
  };
  useEffect(
    () => () => {
      clear(openTimer);
      clear(closeTimer);
    },
    []
  );
  return {
    hovering,
    tick: {
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        setHovering(true);
        clear(closeTimer);
        if (!open && !openTimer.current) {
          openTimer.current = setTimeout(() => {
            openTimer.current = null;
            onOpen("hover");
          }, 140);
        }
      },
      onPointerLeave: (e: React.PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        setHovering(false);
        clear(openTimer);
        if (open === "hover") closeTimer.current = setTimeout(() => onOpen(null), 200);
      },
      onClick: (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest("button")) return;
        onOpen(open && open !== "hover" ? null : "pinned");
      },
    },
    box: {
      onEnter: () => clear(closeTimer),
      onLeave: () => {
        if (open === "hover") closeTimer.current = setTimeout(() => onOpen(null), 220);
      },
    },
  };
}

const FIT_W = 440;

interface TickBoxProps {
  anchor: HTMLElement | null;
  container: HTMLElement | null;
  open: TickOpen;
  onOpen: (open: TickOpen) => void;
  hover: { onEnter: () => void; onLeave: () => void };
  reduced: boolean;
  /** The box's accessible name. */
  label: string;
  /** The key that toggles it, shown in its head. */
  keyHint: string;
  /** Widest the box grows to (it never gets narrower than its tick). */
  width?: number;
  /** The head's text after the label. */
  sub?: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
}

/**
 * A tape tick that grows into a box over the grid: today's moves, the edge's
 * race. Not a dialog: under the pointer it leaves with the pointer; pinned (a
 * click) or opened from the keyboard it stays until its key, Esc or a press
 * elsewhere, and the keyboard's opening takes focus into it.
 */
export function TickBox({ anchor, container, open, onOpen, hover, reduced, label, keyHint, width: maxW = 560, sub, children, foot }: TickBoxProps) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; width: number } | null>(null);

  // Over the tick from its left edge, as wide as the window lets it be; when
  // that leaves too little room, from the tick's right edge instead.
  const measure = useCallback(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const room = vw - 16 - r.left;
    const width = room >= FIT_W ? Math.max(r.width, Math.min(maxW, room)) : Math.min(Math.max(r.width, maxW), vw - 32);
    const left = room >= FIT_W ? r.left : Math.max(16, r.right - width);
    setPlace({ left, top: r.top, width });
  }, [anchor, maxW]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Grow out of the tick: the clip starts at the tick's own rectangle.
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

  // Opened from the keyboard: focus goes to the first row's button, else the first that can act.
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

  if (!place || !container) return null;
  return createPortal(
    <div
      ref={box}
      className={s.tickBox}
      style={{ left: place.left, top: place.top, width: place.width }}
      data-tickbox
      role="region"
      aria-label={label}
      onPointerEnter={(e) => e.pointerType === "mouse" && hover.onEnter()}
      onPointerLeave={(e) => e.pointerType === "mouse" && hover.onLeave()}
      onPointerDown={() => open === "hover" && onOpen("pinned")}
      onKeyDown={(e) => {
        // The desk's keys skip the box, so its own key and Esc close it here.
        if (e.key === "Escape" || (e.key.toLowerCase() === keyHint.toLowerCase() && !e.metaKey && !e.ctrlKey && !e.altKey)) {
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
      <div className={s.tickBoxHead}>
        <span className={dk.label}>{label}</span>
        {sub ? <span className={dk.sub}>{sub}</span> : null}
        <span className={dk.grow} />
        <span className={dk.kbd}>{keyHint}</span>
        <button type="button" className={dk.iconBtn} style={{ width: 24, height: 24 }} onClick={() => onOpen(null)} aria-label={`Close ${label.toLowerCase()}`}>
          <X size={13} />
        </button>
      </div>
      {children}
      {foot ? <div className={s.tickBoxFoot}>{foot}</div> : null}
    </div>,
    container
  );
}
