"use client";

import { X, Columns3, Pin } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { TeamLogo } from "@/components/desk/TeamLogo";
import { sameFocus, shortName, type Focus } from "@/lib/scout";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

interface BenchProps {
  pinned: Focus[];
  focus: Focus | null;
  compare: boolean;
  nameOf: (focus: Focus) => string;
  open: (focus: Focus) => void;
  unpin: (focus: Focus) => void;
  clear: () => void;
  toggleCompare: () => void;
}

/** The pinned players and teams, one chip each, and the way into Compare. */
export function Bench({ pinned, focus, compare, nameOf, open, unpin, clear, toggleCompare }: BenchProps) {
  if (pinned.length === 0) return null;
  const players = pinned.filter((p) => p.kind === "player").length;
  return (
    <div className={s.bench} aria-label="Bench">
      <span className={dk.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Pin size={11} /> Bench
      </span>
      {pinned.map((p) => {
        const on = !compare && sameFocus(p, focus);
        const name = nameOf(p);
        return (
          <span key={p.kind === "player" ? `p${p.id}` : p.kind === "team" ? `t${p.abbrev}` : `d${p.date}`} className={`${s.benchChip} ${on ? s.benchChipOn : ""}`}>
            <button type="button" className={s.benchChip} style={{ border: 0, background: "transparent", padding: 0, height: "auto" }} onClick={() => open(p)} title={name}>
              {p.kind === "player" ? <Headshot nbaId={p.id} name={name} size={20} /> : p.kind === "team" ? <TeamLogo abbrev={p.abbrev} size={20} /> : <span className={s.benchMark}>D</span>}
              <span>{p.kind === "player" ? shortName(name) : name}</span>
            </button>
            <button type="button" className={s.benchX} onClick={() => unpin(p)} aria-label={`Unpin ${name}`}>
              <X size={11} />
            </button>
          </span>
        );
      })}
      <span className={dk.spacer} />
      <button type="button" className={`${dk.btn} ${dk.btnSmall} ${compare ? dk.toggleOn : ""}`} onClick={toggleCompare} disabled={players < 2} title="Pinned players side by side (C)">
        <Columns3 size={13} />
        Compare {players >= 2 ? players : ""}
        <span className={dk.kbd}>C</span>
      </button>
      <button type="button" className={`${dk.ghost}`} style={{ height: 26, fontSize: 12, color: "var(--text-3)" }} onClick={clear}>
        Clear
      </button>
    </div>
  );
}
