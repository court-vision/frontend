"use client";

import { useEffect, useState } from "react";
import { deltaSign, fmtDelta, fmtStat, tier } from "@/lib/scout";
import { formatReportAge } from "@/lib/injury-report";
import type { PlayerStatusData } from "@/types/player";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

/** A titled section of a sheet: a mono label, a note beside it, controls on the right. */
export function Block({
  title,
  note,
  right,
  children,
  className,
}: {
  title: string;
  note?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${s.block} ${className ?? ""}`}>
      <div className={s.blockHead}>
        <span className={s.blockTitle}>{title}</span>
        {note ? <span className={s.blockNote}>{note}</span> : null}
        {right ? <span className={s.blockRight}>{right}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** One big per-game number, with how it differs from the season when a window is on. */
export function StatTile({
  label,
  value,
  delta,
  better = "high",
  lead = false,
  digits = 1,
  deltaNote = "vs season",
}: {
  label: string;
  value: number | null | undefined;
  delta?: number | null;
  better?: "high" | "low";
  lead?: boolean;
  digits?: number;
  deltaNote?: string;
}) {
  const sign = deltaSign(delta, better);
  return (
    <div className={`${s.stat} ${lead ? s.statLead : ""}`}>
      <span className={s.statLabel}>{label}</span>
      <span className={s.statValue}>{fmtStat(value, digits)}</span>
      <span className={s.statDelta} data-sign={sign ?? undefined}>
        {delta != null ? `${fmtDelta(delta, digits)} ${deltaNote}` : ""}
      </span>
    </div>
  );
}

/** A value and where it sits among the league, as a filled track. */
export function PercentBar({ label, value, pct, digits = 1 }: { label: string; value: number | null | undefined; pct: number | null | undefined; digits?: number }) {
  const p = pct == null ? null : Math.max(0, Math.min(100, pct));
  return (
    <div className={s.bar}>
      <span className={s.barLabel}>{label}</span>
      <span className={s.barTrack}>
        {p != null ? <span className={s.barFill} data-tier={tier(p)} style={{ width: `${p}%` }} /> : null}
      </span>
      <span className={s.barValue}>{fmtStat(value, digits)}</span>
      <span className={s.barPct}>{p != null ? `${p}` : "—"}</span>
    </div>
  );
}

/** A signed z-score as a bar from the centre, three standard deviations to each edge. */
export function ZBar({ label, z, value }: { label: string; z: number; value: string }) {
  const clamped = Math.max(-3, Math.min(3, z));
  const width = (Math.abs(clamped) / 3) * 50;
  const left = clamped < 0 ? 50 - width : 50;
  return (
    <div className={s.zbar}>
      <span className={s.barLabel}>{label}</span>
      <span className={s.zTrack}>
        <span className={s.zFill} data-neg={clamped < 0} style={{ left: `${left}%`, width: `${width}%` }} />
      </span>
      <span className={s.barValue} style={{ color: clamped > 0.05 ? "var(--up)" : clamped < -0.05 ? "var(--down)" : undefined }}>
        {value}
      </span>
    </div>
  );
}

export interface KVItem {
  k: string;
  v: string;
  sign?: "up" | "down" | null;
  /** Prose rather than a number. */
  text?: boolean;
  title?: string;
}

export function KV({ items }: { items: KVItem[] }) {
  return (
    <div className={s.kv}>
      {items.map((it) => (
        <div key={it.k} className={s.kvItem} title={it.title}>
          <span className={s.kvKey}>{it.k}</span>
          <span className={`${s.kvVal} ${it.text ? s.kvText : ""}`} data-sign={it.sign ?? undefined}>
            {it.v}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Skeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={className ?? s.sheetSkel} aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className={dk.skel} style={{ width: `${92 - (i % 4) * 14}%`, opacity: 1 - i * 0.07 }} />
      ))}
    </div>
  );
}

/** OUT-class red, day-to-day and questionable amber; nothing for a healthy player. */
export function StatusChip({ status, detail }: { status: PlayerStatusData | null | undefined; detail?: boolean }) {
  const raw = status?.status?.toUpperCase();
  if (!raw || raw === "ACTIVE" || raw === "HEALTHY") return null;
  let cls = dk.flat;
  let text = raw;
  if (["OUT", "O", "IL", "IL+", "SUSPENSION", "INJURY_RESERVE"].includes(raw)) {
    cls = dk.down;
    text = raw === "SUSPENSION" ? "SUSP" : raw === "INJURY_RESERVE" ? "IR" : raw;
  } else if (["DTD", "DAY_TO_DAY"].includes(raw)) {
    cls = dk.warnChip;
    text = "DTD";
  } else if (["GTD", "QUESTIONABLE", "DOUBTFUL", "PROBABLE"].includes(raw)) {
    cls = dk.warnChip;
    text = raw === "QUESTIONABLE" ? "Q" : raw === "DOUBTFUL" ? "DBT" : raw === "PROBABLE" ? "PROB" : raw;
  }
  const age = status ? formatReportAge(status) : null;
  const extra = detail ? [status?.injury_type, age ? `reported ${age}` : null].filter(Boolean).join(" · ") : "";
  return (
    <span className={`${dk.chip} ${cls}`} title={status?.injury_detail ?? undefined}>
      {text}
      {extra ? <span style={{ marginLeft: 6, opacity: 0.8 }}>{extra}</span> : null}
    </span>
  );
}

/** A rank's change over the week as a chip: ▲3, ▼2, or a dash. */
export function MoveChip({ change }: { change: number | null | undefined }) {
  if (change == null || change === 0) return <span className={`${dk.chip} ${dk.flat}`}>·</span>;
  return <span className={`${dk.chip} ${change > 0 ? dk.up : dk.down}`}>{change > 0 ? `▲${change}` : `▼${-change}`}</span>;
}

/** A signed number as a chip, coloured by whether it is good news. */
export function DeltaChip({ value, better = "high", digits = 1, suffix = "" }: { value: number | null | undefined; better?: "high" | "low"; digits?: number; suffix?: string }) {
  const sign = deltaSign(value, better);
  return (
    <span className={`${dk.chip} ${sign === "up" ? dk.up : sign === "down" ? dk.down : dk.flat}`}>
      {fmtDelta(value, digits)}
      {suffix}
    </span>
  );
}

/** True once `key` has stayed the same for `ms`: the extras of a sheet load when it rests, not while flipping. */
export function useSettled(key: string | number | null, ms: number = 400): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    if (key == null) return;
    const t = setTimeout(() => setSettled(true), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return settled;
}

