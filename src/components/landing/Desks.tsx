"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import s from "./landing.module.css";

/**
 * The desks, shown the way they look: a tab per desk and a screenshot of it in
 * the visitor's theme (public/landing/<desk>-<theme>.png, made by
 * scripts/landing-shots.mjs from the desks' sample data).
 */
const DESKS = [
  {
    id: "week",
    name: "Week",
    short: "Set every day's lineup",
    long: "Your matchup week, a column per day: who plays, who sits and what each day is worth. Move players on any day, find pickups for the days you are short, and send it all to ESPN.",
    href: "/week?demo",
    open: "Open the Week demo",
  },
  {
    id: "draft",
    name: "Draft",
    short: "Draft live, or mock first",
    long: "Follow your ESPN draft as it happens, or run a mock against the field. At every pick the board ranks who is left for your roster, and the recap grades each pick when it is over.",
    href: "/lab?demo",
    open: "Open the Draft demo",
  },
  {
    id: "scout",
    name: "Scout",
    short: "Look anyone up",
    long: "One player, team or night at a time, with every public number Court Vision keeps: rankings, game logs, splits, and who is being added and dropped across ESPN.",
    href: "/scout",
    open: "Open Scout",
  },
  {
    id: "dev",
    name: "Developer",
    short: "Use the data yourself",
    long: "The same numbers through a public API. Read the reference, send requests from the playground, make keys, and query the tables directly.",
    href: "/dev",
    open: "Open the Developer desk",
  },
] as const;

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
          Four desks, one season.
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
            <span className={s.tabName}>{d.name}</span>
            <span className={s.tabShort}>{d.short}</span>
          </button>
        ))}
      </div>

      <div className={s.panel} role="tabpanel" id="desk-panel" aria-labelledby={`desk-tab-${desk.id}`}>
        <figure className={s.shot}>
          <Image
            key={`${desk.id}-${theme}`}
            className={s.shotImg}
            src={`/landing/${desk.id}-${theme}.png`}
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
