"use client";

import { useEffect, useState } from "react";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

/** A titled section of a sheet. */
export function Block({ title, note, right, children }: { title: string; note?: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className={s.block}>
      <div className={s.blockHead}>
        <span className={dk.label}>{title}</span>
        {note ? <span className={s.blockNote}>{note}</span> : null}
        {right ? <span className={s.blockRight}>{right}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={s.ledgerSkel} aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className={dk.skel} style={{ width: `${92 - (i % 4) * 11}%` }} />
      ))}
    </div>
  );
}

/** A switch that reads as one, with its label and a line of help. */
export function Toggle({
  label,
  help,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  help?: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={s.toggleRow}>
      <div className={s.toggleBody}>
        <span className={s.toggleLabel}>{label}</span>
        {help ? <span className={s.toggleHelp}>{help}</span> : null}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className={s.switch} disabled={disabled} onClick={() => onChange(!checked)} />
    </div>
  );
}

export function Facts({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <div className={s.facts}>
      {items.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <span className={s.factKey}>{k}</span>
          <span className={s.factValue}>{v}</span>
        </div>
      ))}
    </div>
  );
}

/** The clock, ticking every few seconds, for "checked 3 min ago" lines. */
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return "never";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "never";
  const minutes = Math.max(0, Math.floor((now - ms) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
