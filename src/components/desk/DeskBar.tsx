"use client";

import Link from "next/link";
import { Braces, RotateCw, Sparkles } from "lucide-react";
import { DESKS, DEVELOPER, type DeskId } from "./routes";
import { ThemePicker } from "./ThemePicker";
import dk from "./desk.module.css";

interface DeskBarProps {
  desk: DeskId;
  /** Sample data: the desk tabs stay in the demo, and a badge says so. */
  demo?: boolean;
  /** The desk's context: which team, which room. */
  children?: React.ReactNode;
  /** Desk-specific status on the right, before refresh and theme. */
  right?: React.ReactNode;
  onRefresh?: () => void;
}

/**
 * The top of every desk: the mark, the desks, the desk's context, then status.
 * The mark and the desk tabs stay put; everything after them scrolls sideways
 * when it does not fit, so no control is squeezed or pushed off screen.
 */
export function DeskBar({ desk, demo = false, children, right, onRefresh }: DeskBarProps) {
  return (
    <header className={dk.bar}>
      {/* The old UI's wordmark: the full word from md, its initials on phones. */}
      <Link href="/" className={dk.mark} title="Back to Court Vision" aria-label="Court Vision">
        <span className={dk.markCompact} aria-hidden>
          C<span className={dk.markAccent}>V</span>
        </span>
        <span className={dk.markText} aria-hidden>
          COURT<span className={dk.markAccent}>VISION</span>
        </span>
      </Link>
      <nav className={dk.tabs} aria-label="Desks">
        {DESKS.map((x) => (
          <Link
            key={x.id}
            href={demo ? `${x.href}?demo` : x.href}
            className={dk.tab}
            aria-current={x.id === desk ? "page" : undefined}
          >
            {x.label}
          </Link>
        ))}
      </nav>
      <div className={dk.barScroll}>
        <span className={dk.divider} />
        {children}
        <span className={dk.spacer} />
        {right}
        {demo ? (
          <span className={`${dk.badge} ${dk.badgeDemo}`} title="Sample data. Nothing is sent anywhere.">
            <Sparkles size={11} /> Demo
          </span>
        ) : null}
        {onRefresh ? (
          <button type="button" className={dk.iconBtn} onClick={onRefresh} aria-label="Refresh" title="Refresh">
            <RotateCw size={14} />
          </button>
        ) : null}
        <ThemePicker />
        <Link
          href={demo ? `${DEVELOPER.href}?demo` : DEVELOPER.href}
          className={`${dk.iconBtn} ${dk.iconLink}`}
          aria-label="Developer desk"
          aria-current={desk === DEVELOPER.id ? "page" : undefined}
          title="Developer desk: the API, keys and the query builder"
        >
          <Braces size={14} />
        </Link>
      </div>
    </header>
  );
}

/** The bottom line of every desk: the keys that work here, then whatever the desk reports. */
export function DeskStatus({ keys, children }: { keys: Array<[string, string]>; children?: React.ReactNode }) {
  return (
    <footer className={dk.status}>
      <span className={dk.keys}>
        {keys.map(([k, label]) => (
          <span key={`${k}-${label}`}>
            <span className={dk.kbd}>{k}</span> {label}
          </span>
        ))}
      </span>
      <span className={dk.spacer} />
      {children}
    </footer>
  );
}
