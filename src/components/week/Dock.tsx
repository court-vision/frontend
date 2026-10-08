"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { StreamerPlayer } from "@/types/streamer";
import { signed } from "./format";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

export interface PendingSwap {
  fa: StreamerPlayer;
  /** Who is dropped; null for an add into an open roster spot. */
  out: { id: number; name: string } | null;
  delta: number;
  /** Why it can't be sent right now, if it can't. */
  blocked: string | null;
  /** The day it is scheduled for (a day index); null: made now. */
  from: number | null;
  /** When it could be made: now, or before one of his later game days, with what each does to the week. */
  timings: SwapTiming[];
  /** When the server makes a scheduled one, in words. */
  timing: string | null;
}

export interface SwapTiming {
  day: number | null;
  label: string;
  delta: number;
}

interface DockProps {
  swap: PendingSwap | null;
  onTiming: (day: number | null) => void;
  onCancelSwap: () => void;
  onReviewSwap: () => void;
}

/** The pending add / drop (now or scheduled); staged lineup moves live in the tray. */
export function Dock({ swap, onTiming, onCancelSwap, onReviewSwap }: DockProps) {
  if (!swap) return null;
  return (
    <div className={s.dock} role="region" aria-label="Pending changes">
      {swap ? (
        <div className={s.dockGroup}>
          <span className={dk.label}>{swap.from != null ? "Pickup" : "Roster"}</span>
          <span className={s.dockItems}>
            <span className={`${s.pill} ${s.pillPreview}`}>
              <span style={{ color: "var(--up)" }}>+</span> {swap.fa.name}
            </span>
            {swap.out ? (
              <span className={s.pill}>
                <span style={{ color: "var(--down)" }}>−</span> {swap.out.name}
              </span>
            ) : null}
          </span>
          {swap.timings.length > 1 ? (
            <span className={s.timings} role="radiogroup" aria-label="When to make it">
              {swap.timings.map((t) => (
                <button
                  key={t.day ?? "now"}
                  type="button"
                  role="radio"
                  aria-checked={t.day === swap.from}
                  className={s.timing}
                  onClick={() => onTiming(t.day)}
                  title={t.day == null ? "Add him now" : `Schedule it for ${t.label}: the player you drop plays until then`}
                >
                  {t.label}
                  <span className={s.timingDelta} data-sign={t.delta > 0.05 ? "up" : t.delta < -0.05 ? "down" : "flat"}>
                    {signed(t.delta)}
                  </span>
                </button>
              ))}
            </span>
          ) : (
            <span className={`${dk.chip} ${dk.pv}`} title="Started on his game days">{signed(swap.delta)} week</span>
          )}
          {swap.blocked ? (
            <span className={s.note}>{swap.blocked}</span>
          ) : (
            <span className={s.note}>
              {swap.timing ? `${swap.timing} · click a player to drop him instead` : "Click a player in the grid to drop him instead"}
            </span>
          )}
          <button type="button" className={dk.btn} onClick={onCancelSwap}>
            Cancel
          </button>
          <button
            type="button"
            className={`${dk.btn} ${dk.btnPrimary}`}
            onClick={onReviewSwap}
            disabled={!!swap.blocked}
          >
            {swap.from != null ? "Review pickup" : swap.out ? "Review add / drop" : "Review add"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm
// ---------------------------------------------------------------------------

interface ConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: HTMLElement | null;
  title: string;
  body: string;
  lines: Array<{ key: string; left: React.ReactNode; right?: React.ReactNode }>;
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, onOpenChange, container, title, body, lines, confirmLabel, busy, error, onConfirm }: ConfirmProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className={dk.overlay} />
        <Dialog.Content className={dk.dialog}>
          <div className={dk.dialogBody}>
            <Dialog.Title className={dk.dialogTitle}>{title}</Dialog.Title>
            <Dialog.Description className={dk.dialogText}>{body}</Dialog.Description>
            <div className={s.changeList}>
              {lines.map((l) => (
                <div key={l.key} className={s.change}>
                  <span className={dk.grow}>{l.left}</span>
                  {l.right}
                </div>
              ))}
            </div>
            {error ? <span className={dk.error}>{error}</span> : null}
          </div>
          <div className={dk.dialogFoot}>
            <Dialog.Close asChild>
              <button type="button" className={dk.btn}>
                Cancel
              </button>
            </Dialog.Close>
            <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} onClick={onConfirm} disabled={busy}>
              {busy ? "Sending…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
