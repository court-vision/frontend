"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TapeCell } from "@/lib/draft-tape";
import type { DraftSession } from "@/types/draft";
import { seatName, shortName } from "./format";
import s from "./draft.module.css";

/**
 * Every pick of the draft as one strip: what has been taken, the pick on the
 * clock, and whose the next ones are. It keeps the clock a third of the way in,
 * so the last few picks stay readable on the left.
 */
export function PickTape({ cells, session }: { cells: TapeCell[]; session: DraftSession }) {
  const ref = useRef<HTMLDivElement>(null);
  const now = cells.find((c) => c.state === "now")?.overall ?? cells.at(-1)?.overall ?? 1;
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    const target = el?.querySelector<HTMLElement>(`[data-overall="${now}"]`);
    if (!el || !target) return;
    const left = target.offsetLeft - el.clientWidth / 3;
    el.scrollTo({ left: Math.max(0, left), behavior: first.current ? "auto" : "smooth" });
    first.current = false;
  }, [now, cells.length]);

  // Flash a pick that has just landed.
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const made = useMemo(() => cells.filter((c) => c.state === "made").map((c) => c.overall), [cells]);
  useEffect(() => {
    const prev = seen.current;
    seen.current = new Set(made);
    if (!prev) return;
    const added = made.filter((n) => !prev.has(n));
    if (!added.length) return;
    setFresh(new Set(added.slice(-12)));
    const t = setTimeout(() => setFresh(new Set()), 1000);
    return () => clearTimeout(t);
  }, [made]);

  return (
    <div ref={ref} className={s.tape} aria-label="Pick tape">
      {cells.map((c, i) => {
        const newRound = c.round != null && (i === 0 || cells[i - 1].round !== c.round);
        return (
          <FragmentCell key={c.overall} newRound={newRound} round={c.round}>
            <div
              className={s.cell}
              data-overall={c.overall}
              data-state={c.state}
              data-mine={c.mine}
              data-fresh={fresh.has(c.overall)}
              title={c.pick ? `${c.pick.player_name ?? "?"} · pick ${c.overall} · ${seatName(c.seat, session.my_slot)}` : undefined}
            >
              <span className={s.cellTop}>
                <span>{c.overall}</span>
                <span className={s.cellSeat}>{c.seat != null ? (c.mine ? "YOU" : `S${c.seat}`) : ""}</span>
              </span>
              <span className={s.cellName}>
                {c.pick ? (
                  shortName(c.pick.player_name ?? "—")
                ) : c.state === "now" ? (
                  c.mine ? "You're up" : "On the clock"
                ) : (
                  "·"
                )}
              </span>
            </div>
          </FragmentCell>
        );
      })}
    </div>
  );
}

function FragmentCell({ newRound, round, children }: { newRound: boolean; round: number | null; children: React.ReactNode }) {
  return (
    <>
      {newRound ? <span className={s.roundMark}>R{round}</span> : null}
      {children}
    </>
  );
}
