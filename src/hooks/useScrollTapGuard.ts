"use client";

import { useEffect, type RefObject } from "react";

/** A touch this soon after the last scroll event landed on a page still moving. */
const SCROLL_SETTLE_MS = 120;
/** Finger travel that makes a touch a drag rather than a tap. */
const TAP_SLOP_PX = 10;
/** A click later than this after the touch ended is not that touch's click. */
const CLICK_WINDOW_MS = 800;

/**
 * Swallow the click a touch produces when the touch was really a scroll.
 *
 * Pages scroll inside `<main>`, not the document, and in a scroll container
 * iOS delivers a click for the tap that stops a momentum scroll — so the row
 * under the finger opens mid-scroll. The browser already drops the click of a
 * touch that scrolled; this also drops it when the touch landed while
 * anything under it was still scrolling, travelled past a tap's slop, or used
 * a second finger. Mouse and keyboard clicks are never touched.
 */
export function useScrollTapGuard(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    let lastScrollAt = -Infinity;
    let touch: { x: number; y: number; swallow: boolean; endedAt: number | null } | null = null;

    // `scroll` doesn't bubble; the capture listener still hears every scroller inside.
    const onScroll = () => {
      lastScrollAt = performance.now();
      if (touch && touch.endedAt === null) touch.swallow = true;
    };
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touch = {
        x: t?.clientX ?? 0,
        y: t?.clientY ?? 0,
        swallow: e.touches.length > 1 || performance.now() - lastScrollAt < SCROLL_SETTLE_MS,
        endedAt: null,
      };
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!touch || touch.swallow || !t) return;
      if (Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > TAP_SLOP_PX) touch.swallow = true;
    };
    const onTouchEnd = () => {
      if (touch) touch.endedAt = performance.now();
    };
    const onTouchCancel = () => {
      if (touch) touch = { ...touch, swallow: true, endedAt: performance.now() };
    };
    const onClick = (e: MouseEvent) => {
      // A trackpad click just after a touch-screen scroll (touch laptops) is its own click.
      if ((e as PointerEvent).pointerType === "mouse") return;
      const t = touch;
      if (!t || t.endedAt === null || performance.now() - t.endedAt > CLICK_WINDOW_MS) return;
      touch = null;
      if (!t.swallow) return;
      // Capture phase on <main>: the click never reaches React's root listener
      // or the target, and a link under the finger doesn't navigate.
      e.preventDefault();
      e.stopPropagation();
    };

    const passive = { capture: true, passive: true } as const;
    root.addEventListener("scroll", onScroll, passive);
    root.addEventListener("touchstart", onTouchStart, passive);
    root.addEventListener("touchmove", onTouchMove, passive);
    root.addEventListener("touchend", onTouchEnd, passive);
    root.addEventListener("touchcancel", onTouchCancel, passive);
    root.addEventListener("click", onClick, true);
    return () => {
      root.removeEventListener("scroll", onScroll, true);
      root.removeEventListener("touchstart", onTouchStart, true);
      root.removeEventListener("touchmove", onTouchMove, true);
      root.removeEventListener("touchend", onTouchEnd, true);
      root.removeEventListener("touchcancel", onTouchCancel, true);
      root.removeEventListener("click", onClick, true);
    };
  }, [ref]);
}
