"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";

/** Finger travel before a drag is judged (same axis lock as a row swipe). */
const COMMIT_PX = 6;
/** Page travel per px of finger travel. */
const RESISTANCE = 0.5;
/** Page travel at which the ball reaches the rim: it drops through and the refresh starts. */
const TRIGGER_PX = 72;
const MAX_PX = 104;
/** How far the page stays down while the refresh runs: the whole court (`top-1 h-14`) in view. */
const REST_PX = 64;
/** The page's slide to rest or back up, ms. */
const SETTLE_MS = 200;
/** Keep the court up at least this long, so a fast refetch still shows the swish… */
const MIN_SPIN_MS = 900;
/** …and stop waiting on a slow one after this long (the queries carry on). */
const MAX_SPIN_MS = 10_000;

// The court, in viewBox units (0 0 160 56; one unit is one CSS px). The shot
// is a quadratic Bézier from the release point to the middle of the rim. It
// starts high and ends low because the page uncovers the court from the top
// down: wherever the pull has put the ball, the page has already slid past it.
const RELEASE = { x: 14, y: 20 };
const CONTROL = { x: 64, y: -12 };
const RIM = { x: 128, y: 34 };
/** How far the ball falls through the net after the rim. */
const DROP = 20;

/** While the refresh runs, shots on a loop: the arc, the swish, a beat. */
const ARC_MS = 700;
const SWISH_MS = 320;
const PAUSE_MS = 180;

interface Court {
  ball: SVGGElement;
  trail: SVGPathElement;
  net: SVGGElement;
}

/**
 * Put the ball at `p` along its shot: 0–1 is the arc from the release to the
 * rim, with the dotted trail behind it; 1–2 is the drop through the net,
 * which stretches as the ball passes and lets it fade out below.
 */
function drawShot({ ball, trail, net }: Court, p: number) {
  const t = Math.min(1, Math.max(0, p));
  const s = Math.min(1, Math.max(0, p - 1));
  const u = 1 - t;
  const ax = u * u * RELEASE.x + 2 * u * t * CONTROL.x + t * t * RIM.x;
  const ay = u * u * RELEASE.y + 2 * u * t * CONTROL.y + t * t * RIM.y;
  // de Casteljau: the stretch of arc already travelled is itself a quadratic.
  const cx = RELEASE.x + (CONTROL.x - RELEASE.x) * t;
  const cy = RELEASE.y + (CONTROL.y - RELEASE.y) * t;
  trail.setAttribute(
    "d",
    t > 0 ? `M${RELEASE.x} ${RELEASE.y}Q${cx.toFixed(2)} ${cy.toFixed(2)} ${ax.toFixed(2)} ${ay.toFixed(2)}` : ""
  );

  const x = s > 0 ? RIM.x : ax;
  const y = s > 0 ? RIM.y + DROP * (1 - (1 - s) * (1 - s)) : ay;
  ball.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${Math.round(p * 540)})`);
  ball.setAttribute("opacity", s < 0.6 ? "1" : (1 - (s - 0.6) / 0.4).toFixed(2));

  const k = Math.sin(Math.PI * Math.min(1, s * 1.6));
  net.setAttribute(
    "transform",
    `translate(${RIM.x} ${RIM.y}) scale(${(1 - 0.12 * k).toFixed(3)} ${(1 + 0.3 * k).toFixed(3)}) translate(${-RIM.x} ${-RIM.y})`
  );
}

/** Neither the scroll area nor any scroller between it and the touch is scrolled down. */
function atTop(target: EventTarget | null, scroller: HTMLElement): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== scroller; el = el.parentElement) {
    if (el.scrollTop > 0) return false;
  }
  return scroller.scrollTop <= 0;
}

/**
 * Pull-to-refresh for the page's scroll area. Drag down from the top and the
 * page slides after the finger, uncovering a little court behind it: the pull
 * carries a basketball along its arc, leaving a dotted trail, and the moment
 * it drops through the hoop every query on screen refetches — shots keep
 * falling while the page holds the court open. The document never scrolls
 * (pages scroll inside `<main>`, body has `overscroll-behavior: none`), so
 * the browser's own gesture never fires. Touch only.
 *
 * Render it just before the scroller, both inside a `relative
 * overflow-hidden` box (the box keeps the court below the header and clips
 * the slid page at the bottom), and give the scroller an opaque background so
 * it hides the court at rest.
 */
export function PullToRefresh({ scrollerRef }: { scrollerRef: RefObject<HTMLElement | null> }) {
  const queryClient = useQueryClient();
  const ballRef = useRef<SVGGElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const netRef = useRef<SVGGElement>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const ball = ballRef.current;
    const trail = trailRef.current;
    const net = netRef.current;
    if (!scroller || !ball || !trail || !net) return;
    const court: Court = { ball, trail, net };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let busy = false;
    let raf = 0;
    let pull: {
      x: number;
      y: number;
      state: "pending" | "pulling" | "off";
      distance: number;
      /** This gesture already sank its shot; the refresh it started owns the court. */
      fired: boolean;
    } | null = null;

    // Straight to the DOM: a pull repaints on every touchmove, and a render would trail the finger.
    const paintPage = (distance: number, animate: boolean) => {
      scroller.style.transition = animate ? `transform ${SETTLE_MS}ms ease-out` : "none";
      // At rest the transform goes entirely (not `translateY(0)`): a transformed
      // scroller is the containing block for any `position: fixed` inside it.
      scroller.style.transform = distance > 0 ? `translate3d(0, ${distance}px, 0)` : "";
    };

    // Shots on a loop until the refetch settles, picking up at the rim where the pull left the ball.
    const startShooting = () => {
      if (reducedMotion.matches) {
        drawShot(court, 1.35); // resting in the stretched net
        return;
      }
      const cycle = ARC_MS + SWISH_MS + PAUSE_MS;
      const start = performance.now() - ARC_MS;
      const tick = (now: number) => {
        const e = (now - start) % cycle;
        drawShot(court, e < ARC_MS ? e / ARC_MS : 1 + Math.min(1, (e - ARC_MS) / SWISH_MS));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const refresh = async () => {
      busy = true;
      setRefreshing(true);
      startShooting();
      await Promise.race([
        Promise.all([queryClient.refetchQueries({ type: "active" }), sleep(MIN_SPIN_MS)]),
        sleep(MAX_SPIN_MS),
      ]);
      cancelAnimationFrame(raf);
      busy = false;
      setRefreshing(false);
      // A finger still holding the page lets go of it in touchend.
      if (pull?.state !== "pulling") paintPage(0, true);
    };

    const onTouchStart = (e: TouchEvent) => {
      // A second finger ends the pull in progress.
      if (pull?.state === "pulling") paintPage(busy ? REST_PX : 0, true);
      const t = e.touches[0];
      pull =
        !busy && t && e.touches.length === 1 && atTop(e.target, scroller)
          ? { x: t.clientX, y: t.clientY, state: "pending", distance: 0, fired: false }
          : null;
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!pull || pull.state === "off" || !t) return;
      if (e.touches.length > 1) {
        if (pull.state === "pulling") paintPage(busy ? REST_PX : 0, true);
        pull.state = "off";
        return;
      }
      const dx = t.clientX - pull.x;
      const dy = t.clientY - pull.y;
      if (pull.state === "pending") {
        if (Math.abs(dx) < COMMIT_PX && Math.abs(dy) < COMMIT_PX) return;
        // Upward (a scroll), sideways (a table or a row swipe), or the browser
        // has already taken the gesture: not a pull.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || !e.cancelable) {
          pull.state = "off";
          return;
        }
        pull.state = "pulling";
      }
      if (e.cancelable) e.preventDefault();
      pull.distance = Math.min(MAX_PX, Math.max(0, (dy - COMMIT_PX) * RESISTANCE));
      paintPage(pull.distance, false);
      if (pull.fired) return;
      const progress = pull.distance / TRIGGER_PX;
      drawShot(court, Math.min(1, progress));
      // Nothing but net: refresh now, finger down or not (the page settles on release).
      if (progress >= 1) {
        pull.fired = true;
        void refresh();
      }
    };

    const onTouchEnd = () => {
      const p = pull;
      pull = null;
      if (p?.state === "pulling") paintPage(busy ? REST_PX : 0, true);
    };

    const capture = { capture: true, passive: true } as const;
    scroller.addEventListener("touchstart", onTouchStart, capture);
    // Not passive: a pull cancels the move so the scroller doesn't rubber-band with it.
    scroller.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    scroller.addEventListener("touchend", onTouchEnd, capture);
    scroller.addEventListener("touchcancel", onTouchEnd, capture);
    return () => {
      cancelAnimationFrame(raf);
      scroller.removeEventListener("touchstart", onTouchStart, true);
      scroller.removeEventListener("touchmove", onTouchMove, true);
      scroller.removeEventListener("touchend", onTouchEnd, true);
      scroller.removeEventListener("touchcancel", onTouchEnd, true);
      scroller.style.transition = "";
      scroller.style.transform = "";
    };
  }, [scrollerRef, queryClient]);

  // Absolute and earlier in the tree than the scroller, which paints over it.
  return (
    <div role="status" className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2">
      {refreshing && <span className="sr-only">Refreshing</span>}
      <svg viewBox="0 0 160 56" className="h-14 w-40" fill="none" strokeLinecap="round" aria-hidden>
        {/* Backboard and bracket */}
        <path d="M148 12V40M148 33.5H140.5" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" />
        {/* Back of the rim, behind the ball */}
        <path d="M116 34A12 3 0 0 1 140 34" stroke="currentColor" strokeWidth="1.8" className="text-primary" />
        <path
          ref={trailRef}
          d=""
          stroke="currentColor"
          strokeWidth="1.6"
          strokeDasharray="0 4.5"
          opacity={0.7}
          className="text-muted-foreground"
        />
        <g ref={ballRef} transform={`translate(${RELEASE.x} ${RELEASE.y})`}>
          <circle r="5.5" fill="#E0782F" stroke="#40230F" strokeWidth="0.8" />
          <path
            d="M-5.5 0H5.5M0-5.5V5.5M-3.9-3.9Q-1.2 0-3.9 3.9M3.9-3.9Q1.2 0 3.9 3.9"
            stroke="#40230F"
            strokeWidth="0.7"
          />
        </g>
        {/* Net, then the front of the rim over it */}
        <g ref={netRef} stroke="currentColor" strokeWidth="0.8" className="text-muted-foreground">
          <path d="M116.5 34.5 121 48M139.5 34.5 135 48M122 35 124.5 48M134 35 131.5 48M128 35.2V48M118.6 41H137.4M121 48H135" />
        </g>
        <path d="M116 34A12 3 0 0 0 140 34" stroke="currentColor" strokeWidth="1.8" className="text-primary" />
      </svg>
    </div>
  );
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
