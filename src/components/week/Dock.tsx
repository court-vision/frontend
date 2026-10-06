"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { slotName } from "@/lib/lineup-editor";
import type { LineupMove, LineupPlayer, MoveError } from "@/types/lineup-editor";
import type { StreamerPlayer } from "@/types/streamer";
import { shortName, signed } from "./format";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

/** One day's staged moves and the problems they'd hit at ESPN. */
export interface PendingDay {
  day: number;
  label: string;
  moves: LineupMove[];
  problems: MoveError[];
}

export interface PendingSwap {
  fa: StreamerPlayer;
  out: { id: number; name: string };
  delta: number;
  /** Why it can't be sent right now, if it can't. */
  blocked: string | null;
}

interface DockProps {
  pending: PendingDay[];
  playerById: ReadonlyMap<number, LineupPlayer>;
  stagedDelta: number;
  canSendMoves: boolean;
  movesBlocked: string | null;
  onDiscardMoves: () => void;
  onReviewMoves: () => void;
  swap: PendingSwap | null;
  onCancelSwap: () => void;
  onReviewSwap: () => void;
}

export function Dock({
  pending,
  playerById,
  stagedDelta,
  canSendMoves,
  movesBlocked,
  onDiscardMoves,
  onReviewMoves,
  swap,
  onCancelSwap,
  onReviewSwap,
}: DockProps) {
  const problems = pending.flatMap((p) => p.problems.map((e) => `${p.label}: ${e.message}`));
  if (pending.length === 0 && !swap) return null;
  return (
    <div className={s.dock} role="region" aria-label="Pending changes">
      {pending.length > 0 ? (
        <div className={s.dockGroup}>
          <span className={dk.label}>ESPN lineup</span>
          <span className={s.dockItems}>
            {pending.flatMap((p) =>
              p.moves.map((m) => (
                <span key={`${p.day}-${m.player_id}`} className={`${s.pill} ${s.pillWarn}`}>
                  <span className={s.arrow}>{p.label.split(" ")[0]}</span>
                  {shortName(playerById.get(m.player_id)?.name ?? `#${m.player_id}`)}
                  <span className={s.arrow}>
                    {slotName(m.from_slot_id)} → {slotName(m.to_slot_id)}
                  </span>
                </span>
              ))
            )}
          </span>
          <span className={`${dk.chip} ${stagedDelta > 0.05 ? dk.up : stagedDelta < -0.05 ? dk.down : dk.flat}`}>
            {signed(stagedDelta)}
          </span>
          {problems.length ? <span className={dk.error}>{problems[0]}</span> : null}
          {movesBlocked ? <span className={s.note}>{movesBlocked}</span> : null}
          <button type="button" className={dk.btn} onClick={onDiscardMoves}>
            Discard
          </button>
          <button
            type="button"
            className={`${dk.btn} ${dk.btnPrimary}`}
            onClick={onReviewMoves}
            disabled={!canSendMoves || problems.length > 0}
          >
            Review and send
          </button>
        </div>
      ) : null}
      {swap ? (
        <div className={s.dockGroup}>
          <span className={dk.label}>Roster</span>
          <span className={s.dockItems}>
            <span className={`${s.pill} ${s.pillPreview}`}>
              <span style={{ color: "var(--up)" }}>+</span> {swap.fa.name}
            </span>
            <span className={s.pill}>
              <span style={{ color: "var(--down)" }}>−</span> {swap.out.name}
            </span>
          </span>
          <span className={`${dk.chip} ${dk.pv}`} title="Started on his game days">{signed(swap.delta)} week</span>
          {swap.blocked ? <span className={s.note}>{swap.blocked}</span> : null}
          <button type="button" className={dk.btn} onClick={onCancelSwap}>
            Cancel
          </button>
          <button
            type="button"
            className={`${dk.btn} ${dk.btnPrimary}`}
            onClick={onReviewSwap}
            disabled={!!swap.blocked}
          >
            Review add / drop
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
        <Dialog.Content className={dk.dialog} aria-describedby={undefined}>
          <div className={dk.dialogBody}>
            <Dialog.Title className={dk.dialogTitle}>{title}</Dialog.Title>
            <p className={dk.dialogText}>{body}</p>
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
