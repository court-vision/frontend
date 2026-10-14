"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { pillBox, samePillBox, type PillBox } from "@/lib/seg-pill";
import dk from "./desk.module.css";

const CHECKED = ':scope > [role="radio"][aria-checked="true"]';
const SEGMENTS = ':scope > [role="radio"]';

/**
 * A segmented rail (`dk.rail`) whose pill slides to the checked segment. The
 * segments are the rail's `role="radio"` buttons, as every rail already
 * writes them; `active` names the checked one, so the pill moves when it
 * changes.
 *
 * The pill is one indicator, placed with transform and width from the checked
 * button's box and moved by a CSS transition. It replaces motion's layoutId
 * pill, which was the only thing Scout, Developer and Draft used motion for
 * and cost each of them about 42 KB br of first-load JS. The Week desk keeps
 * motion for its real layout animations. Until the indicator has measured
 * (the server render, before hydration) the checked segment draws a pill of
 * its own in CSS, so the rail never shows without one.
 */
export function SegRail({
  label,
  active,
  className,
  children,
}: {
  label: string;
  active: string | number | boolean | null;
  className?: string;
  children: React.ReactNode;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<PillBox | null>(null);

  useLayoutEffect(() => {
    const el = rail.current;
    if (!el) return;
    const measure = () => {
      const next = pillBox(el.querySelector<HTMLElement>(CHECKED));
      setBox((prev) => (samePillBox(prev, next) ? prev : next));
    };
    measure();
    // Labels change width after the effect (counts load, fonts swap) and the
    // rail can be hidden and shown; re-measure whenever a box changes.
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.querySelectorAll(SEGMENTS).forEach((seg) => ro.observe(seg));
    return () => ro.disconnect();
  }, [active]);

  return (
    <div ref={rail} className={`${dk.rail} ${dk.segRail} ${className ?? ""}`} role="radiogroup" aria-label={label} data-pill={box ? "" : undefined}>
      {box ? <span className={dk.segIndicator} style={{ width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` }} aria-hidden /> : null}
      {children}
    </div>
  );
}
