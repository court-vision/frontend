"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { DeskDialog } from "@/components/desk/DeskDialog";
import { Headshot } from "@/components/desk/Headshot";
import dk from "@/components/desk/desk.module.css";
import type { DraftBoardRow, DraftKeeper, DraftSession } from "@/types/draft";
import s from "./draft.module.css";

// ---------------------------------------------------------------------------
// Seat
// ---------------------------------------------------------------------------

export function SeatDialog({
  session,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  session: DraftSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (slot: number | null) => void;
  saving: boolean;
}) {
  const seats = session.pick_order.length || session.league_size || 0;
  const [slot, setSlot] = useState<number | null>(session.my_slot);
  useEffect(() => {
    if (open) setSlot(session.my_slot);
  }, [open, session.my_slot]);
  return (
    <DeskDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Your seat"
      description="Which pick in the first round is yours. It decides whose turn it is, what your keepers cost and which picks the tape marks as yours."
      footer={
        <>
          {session.my_slot != null ? (
            <button type="button" className={dk.btn} disabled={saving} onClick={() => onSave(null)}>
              Clear
            </button>
          ) : null}
          <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} disabled={saving || slot == null || slot === session.my_slot} onClick={() => onSave(slot)}>
            {saving ? "Saving…" : slot != null ? `Draft from seat ${slot}` : "Pick a seat"}
          </button>
        </>
      }
    >
      {seats === 0 ? (
        <span className={dk.sub}>This room has no pick order yet, so there are no seats to choose from.</span>
      ) : (
        <div className={s.seats}>
          {Array.from({ length: seats }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={s.seatBtn} aria-pressed={slot === n} onClick={() => setSlot(n)}>
              {n}
            </button>
          ))}
        </div>
      )}
    </DeskDialog>
  );
}

// ---------------------------------------------------------------------------
// Keepers
// ---------------------------------------------------------------------------

export function KeepersDialog({
  session,
  rows,
  open,
  onOpenChange,
  onSave,
  saving,
  onEditSeat,
}: {
  session: DraftSession;
  rows: DraftBoardRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (keepers: DraftKeeper[]) => void;
  saving: boolean;
  onEditSeat: () => void;
}) {
  const [list, setList] = useState<DraftKeeper[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) return;
    setList(session.keepers.map((k) => ({ player_id: k.player_id, espn_player_id: k.espn_player_id, name: k.name, round: k.round ?? null })));
    setQuery("");
  }, [open, session.keepers]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const chosen = new Set(list.map((k) => k.player_id));
    return rows.filter((r) => !chosen.has(r.player_id) && r.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, rows, list]);
  const allowance = session.keeper_count ?? null;
  const over = allowance != null && list.length > allowance;

  return (
    <DeskDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Keepers"
      description="Who you keep and the round each one costs. Record them from the roster once the list is right — each takes your pick in its round and leaves the board."
      footer={
        <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} disabled={saving} onClick={() => onSave(list)}>
          {saving ? "Saving…" : "Save keepers"}
        </button>
      }
    >
      <div className={s.field} style={{ position: "relative" }}>
        <input className={dk.input} placeholder="Add a keeper — type a name" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        {matches.length ? (
          <div className={dk.menu} style={{ position: "absolute", top: 36, left: 0, right: 0, width: "auto" }}>
            <div className={dk.menuList}>
              {matches.map((r) => (
                <button
                  key={r.player_id}
                  type="button"
                  className={dk.menuItem}
                  onClick={() => {
                    setList((l) => [...l, { player_id: r.player_id, espn_player_id: r.espn_id ?? null, name: r.name, round: null }]);
                    setQuery("");
                  }}
                >
                  <Headshot nbaId={r.player_id} name={r.name} size={22} />
                  <span className={dk.grow}>{r.name}</span>
                  <span className={dk.sub}>
                    {r.team} · {r.primary_position}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {list.length === 0 ? (
        <span className={dk.sub}>No keepers yet.</span>
      ) : (
        <div>
          {list.map((k, i) => (
            <div key={`${k.player_id ?? k.name}-${i}`} className={s.keeperRow}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Headshot nbaId={k.player_id ?? null} name={k.name ?? "?"} size={22} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name}</span>
              </span>
              <input
                className={dk.input}
                style={{ height: 28 }}
                type="number"
                min={1}
                max={session.rounds ?? 40}
                placeholder="round"
                value={k.round ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Math.max(1, Math.floor(Number(e.target.value)));
                  setList((l) => l.map((x, j) => (j === i ? { ...x, round: v } : x)));
                }}
              />
              <button type="button" className={dk.iconBtn} style={{ width: 28, height: 28 }} aria-label={`Remove ${k.name}`} onClick={() => setList((l) => l.filter((_, j) => j !== i))}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <span className={s.fieldHelp} style={over ? { color: "var(--warn)" } : undefined}>
        {allowance != null ? `Your league allows ${allowance}. ` : ""}
        {session.my_slot == null ? (
          <>
            A keeper is priced at your pick in its round —{" "}
            <button type="button" className={dk.link} style={{ background: "none", border: 0, padding: 0, font: "inherit", cursor: "pointer" }} onClick={onEditSeat}>
              set your seat
            </button>{" "}
            first.
          </>
        ) : null}
      </span>
    </DeskDialog>
  );
}
