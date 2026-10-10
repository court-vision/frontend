"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThemePicker } from "@/components/desk/ThemePicker";
import { useDeskScheme, useDeskTheme } from "@/components/desk/useDeskTheme";
import { CourtField } from "./CourtField";
import { Desks } from "./Desks";
import { SPECKS, STAT_WALL } from "./stat-wall";
import s from "./landing.module.css";

/**
 * The signed-out front page, in the desks' frame and theme (the root layout's
 * DeskFrame): the moving court and one line up top, the desks below, then a
 * way in.
 */
export function Landing() {
  const scheme = useDeskScheme();
  const toggle = useDeskTheme((st) => st.toggle);
  const hero = useRef<HTMLElement>(null);
  const [live, setLive] = useState(false);

  // The backdrop leans against the camera: the pointer's place, as -0.5..0.5, for the CSS.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        hero.current?.style.setProperty("--lean-x", (e.clientX / window.innerWidth - 0.5).toFixed(3));
        hero.current?.style.setProperty("--lean-y", (e.clientY / window.innerHeight - 0.5).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // T swaps the theme for its pair, as on every desk.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [role='dialog']")) return;
      if (e.key === "t" || e.key === "T") toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <div className={s.page} data-landing data-scheme={scheme}>
      <section ref={hero} className={s.hero} data-live={live ? "" : undefined}>
        <pre className={s.wall} aria-hidden>
          {STAT_WALL}
        </pre>
        {/* Loose specks until the dot field has started; then it takes over. */}
        <svg className={s.specks} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
          {SPECKS.map(([x, y, r, accent], i) => (
            <circle key={i} cx={x} cy={y} r={r} className={accent ? s.speckAccent : undefined} />
          ))}
        </svg>
        <CourtField className={s.field} onLive={() => setLive(true)} />
        <header className={s.top}>
          <Link href="/" className={s.mark} aria-label="Court Vision">
            <span aria-hidden>
              COURT<span className={s.markAccent}>VISION</span>
            </span>
          </Link>
          <nav className={s.topNav} aria-label="Account">
            <Link href="/sign-in" className={s.topLink}>
              Sign in
            </Link>
            <ThemePicker />
          </nav>
        </header>
        <div className={s.heroCopy}>
          <h1 className={s.headline}>See the whole floor.</h1>
          <p className={s.lede}>Lineups, pickups and drafts for your ESPN fantasy basketball league.</p>
          <div className={s.actions}>
            <Link href="/week?demo" className={s.primary}>
              Try the demo
            </Link>
            <Link href="/sign-up" className={s.secondary}>
              Create an account
            </Link>
          </div>
        </div>
      </section>

      <Desks />

      <section className={s.closing} aria-labelledby="closing-title">
        <pre className={`${s.wall} ${s.closingWall}`} aria-hidden>
          {STAT_WALL}
        </pre>
        <h2 id="closing-title" className={s.h2}>
          Bring your league.
        </h2>
        <p className={s.closingText}>
          Create an account and add your ESPN team. Every desk then works from your league&apos;s own scoring, roster
          spots and schedule.
        </p>
        <div className={s.actions}>
          <Link href="/sign-up" className={s.primary}>
            Create an account
          </Link>
          <Link href="/sign-in" className={s.secondary}>
            Sign in
          </Link>
        </div>
      </section>

      <footer className={s.footer}>
        <span className={s.footMark} aria-hidden>
          COURT<span className={s.markAccent}>VISION</span>
        </span>
        <nav className={s.footNav} aria-label="More">
          <Link href="/scout">Scout</Link>
          <Link href="/developer">API</Link>
          <a href="https://github.com/court-vision" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
        <span className={s.footNote}>© 2026 Court Vision</span>
      </footer>
    </div>
  );
}
