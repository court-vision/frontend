"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { slotName } from "@/lib/lineup-editor";
import type { LineupMove, LineupPlayer, MoveError } from "@/types/lineup-editor";
import type { StreamerPlayer } from "@/types/streamer";
import { shortName, signed } from "./format";
import s from "./week.module.css";

export interface PendingSwap {
  fa: StreamerPlayer;
  out: { id: number; name: string };
  delta: number;
  /** Why it can't be sent right now, if it can't. */
  blocked: string | null;
}

interface DockProps {
  moves: LineupMove[];
  playerById: ReadonlyMap<number, LineupPlayer>;
  stagedDelta: number;
  problems: MoveError[];
  canSendMoves: boolean;
  movesBlocked: string | null;
  onDiscardMoves: () => void;
  onReviewMoves: () => void;
  swap: PendingSwap | null;
  onCancelSwap: () => void;
  onReviewSwap: () => void;
}

export function Dock({
  moves,
  playerById,
  stagedDelta,
  problems,
  canSendMoves,
  movesBlocked,
  onDiscardMoves,
  onReviewMoves,
  swap,
  onCancelSwap,
  onReviewSwap,
}: DockProps) {
  if (moves.length === 0 && !swap) return null;
  return (
    <div className={s.dock} role="region" aria-label="Pending changes">
      {moves.length > 0 ? (
        <div className={s.dockGroup}>
          <span className={s.label}>ESPN lineup</span>
          <span className={s.dockItems}>
            {moves.map((m) => (
              <span key={m.player_id} className={`${s.pill} ${s.pillWarn}`}>
                {shortName(playerById.get(m.player_id)?.name ?? `#${m.player_id}`)}
                <span className={s.arrow}>
                  {slotName(m.from_slot_id)} → {slotName(m.to_slot_id)}
                </span>
              </span>
            ))}
          </span>
          <span className={`${s.chip} ${stagedDelta > 0.05 ? s.up : stagedDelta < -0.05 ? s.down : s.flat}`}>
            {signed(stagedDelta)}
          </span>
          {problems.length ? <span className={s.error}>{problems[0].message}</span> : null}
          {movesBlocked ? <span className={s.note}>{movesBlocked}</span> : null}
          <button type="button" className={s.btn} onClick={onDiscardMoves}>
            Discard
          </button>
          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary}`}
            onClick={onReviewMoves}
            disabled={!canSendMoves || problems.length > 0}
          >
            Review and send
          </button>
        </div>
      ) : null}
      {swap ? (
        <div className={s.dockGroup}>
          <span className={s.label}>Roster</span>
          <span className={s.dockItems}>
            <span className={`${s.pill} ${s.pillPreview}`}>
              <span style={{ color: "var(--up)" }}>+</span> {swap.fa.name}
            </span>
            <span className={s.pill}>
              <span style={{ color: "var(--down)" }}>−</span> {swap.out.name}
            </span>
          </span>
          <span className={`${s.chip} ${s.pv}`} title="Started on his game days">{signed(swap.delta)} week</span>
          {swap.blocked ? <span className={s.note}>{swap.blocked}</span> : null}
          <button type="button" className={s.btn} onClick={onCancelSwap}>
            Cancel
          </button>
          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary}`}
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
        <Dialog.Overlay className={s.overlay} />
        <Dialog.Content className={s.dialog} aria-describedby={undefined}>
          <div className={s.dialogBody}>
            <Dialog.Title className={s.dialogTitle}>{title}</Dialog.Title>
            <p className={s.dialogText}>{body}</p>
            <div className={s.changeList}>
              {lines.map((l) => (
                <div key={l.key} className={s.change}>
                  <span className={s.grow}>{l.left}</span>
                  {l.right}
                </div>
              ))}
            </div>
            {error ? <span className={s.error}>{error}</span> : null}
          </div>
          <div className={s.dialogFoot}>
            <Dialog.Close asChild>
              <button type="button" className={s.btn}>
                Cancel
              </button>
            </Dialog.Close>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onConfirm} disabled={busy}>
              {busy ? "Sending…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
