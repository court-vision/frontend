"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import { LANDING_DESKS, landingShot } from "@/lib/landing";
import s from "./landing.module.css";

/** The desks, shown the way they look: a tab per desk and its picture in the visitor's theme (lib/landing.ts). */
const DESKS = LANDING_DESKS;

export function Desks() {
  const theme = useDeskTheme((st) => st.theme);
  const [current, setCurrent] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const desk = DESKS[current];

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const nextIndex = (current + step + DESKS.length) % DESKS.length;
    setCurrent(nextIndex);
    tabs.current[nextIndex]?.focus();
  };

  return (
    <section className={s.desks} aria-labelledby="desks-title">
      <div className={s.desksHead}>
        <h2 id="desks-title" className={s.h2}>
          Six desks, one season.
        </h2>
        <p className={s.intro}>
          Each desk does one job from start to finish. All of them open with sample data, so you can look around
          before you bring a league.
        </p>
      </div>

      <div className={s.tabs} role="tablist" aria-label="Desks" onKeyDown={onKey}>
        {DESKS.map((d, i) => (
          <button
            key={d.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`desk-tab-${d.id}`}
            aria-selected={i === current}
            aria-controls="desk-panel"
            tabIndex={i === current ? 0 : -1}
            className={s.tab}
            onClick={() => setCurrent(i)}
          >
            <span className={s.tabName}>
              {d.name}
              {d.badge ? <span className={s.tabBadge}>{d.badge}</span> : null}
            </span>
            <span className={s.tabShort}>{d.short}</span>
          </button>
        ))}
      </div>

      <div className={s.panel} role="tabpanel" id="desk-panel" aria-labelledby={`desk-tab-${desk.id}`}>
        <figure className={s.shot}>
          <Image
            key={`${desk.id}-${theme}`}
            className={s.shotImg}
            src={landingShot(desk.id, theme)}
            alt={`The ${desk.name} desk with sample data`}
            width={1440}
            height={900}
            sizes="(max-width: 1240px) 100vw, 1200px"
          />
        </figure>
        <div className={s.panelText}>
          <p>{desk.long}</p>
          <Link href={desk.href} className={s.secondary}>
            {desk.open}
          </Link>
        </div>
      </div>
    </section>
  );
}
