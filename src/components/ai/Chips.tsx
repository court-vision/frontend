"use client";

import { Check, X } from "lucide-react";
import { changeLabel, chipState, patchChip, type ChipPatch } from "@/lib/ai-proposals";
import { monthDay, weekdayTime } from "@/components/week/format";
import { Tray, type TrayDay } from "@/components/week/Tray";
import type { AiProposalChip } from "@/types/ai";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/**
 * A chip: a roster move the agent proposed and the server checked (backend
 * services/ai/proposals.py). "Stage" puts it in the tray under the thread; the
 * tray is the Week desk's own (`Tray` + `SlideToSend`), and its slider sends
 * the move through the Week desk's writes. The chip itself never sends anything.
 */

/** What the thread needs to render and act on its chips. */
export interface ChipActions {
  stagedIds: ReadonlySet<number>;
  patches: ReadonlyMap<number, ChipPatch>;
  /** A send is running: no staging or dismissing until it settles. */
  busy: boolean;
  onStage: (chip: AiProposalChip) => void;
  onUnstage: (proposalId: number) => void;
  onDismiss: (chip: AiProposalChip) => void;
}

const STATE_LABEL: Record<"sent" | "dismissed" | "expired", string> = {
  sent: "Sent",
  dismissed: "Dismissed",
  expired: "Expired",
};

export function ProposalChip({ chip: raw, actions }: { chip: AiProposalChip; actions: ChipActions }) {
  const chip = patchChip(raw, actions.patches);
  const state = chipState(chip);
  const staged = state === "proposed" && actions.stagedIds.has(chip.proposal_id);
  const when = chip.kind === "transaction" ? "Today" : `${chip.dow} ${monthDay(chip.date)}`;
  const how = chip.kind === "transaction" ? "goes to ESPN when you send it" : "scheduled: made for you ahead of that day's games";
  const change = changeLabel(chip);
  const tone = chip.change == null ? dk.flat : chip.change > 0.05 ? dk.up : chip.change < -0.05 ? dk.down : dk.flat;
  return (
    <div className={s.chip} data-state={state} data-staged={staged || undefined} role="group" aria-label="Proposed move">
      <div className={s.chipHead}>
        <span className={dk.label}>CV AI proposes</span>
        <span>
          {when} · {how}
        </span>
      </div>
      <div className={s.chipMove}>
        {chip.add ? (
          <span>
            <b className={s.chipSign}>+</b>
            {chip.add.name}
            {chip.add.team ? <span className={s.chipTeam}>{chip.add.team}</span> : null}
          </span>
        ) : null}
        {chip.drop ? (
          <span>
            <b className={s.chipSign}>−</b>
            {chip.drop.name}
            {chip.drop.team ? <span className={s.chipTeam}>{chip.drop.team}</span> : null}
          </span>
        ) : chip.add ? (
          <span className={dk.sub}>into an open roster spot</span>
        ) : null}
        {change ? (
          <span className={`${dk.chip} ${tone}`} title={chip.scoring === "categories" ? "Projected change in category wins" : "Projected change to your week"}>
            {change}
          </span>
        ) : null}
      </div>
      <div className={s.chipReason}>{chip.reason}</div>
      <div className={s.chipFoot}>
        {state === "proposed" ? (
          <>
            <button
              type="button"
              className={`${dk.btn} ${dk.btnSmall} ${staged ? "" : dk.btnPrimary}`}
              aria-pressed={staged}
              disabled={actions.busy}
              onClick={() => (staged ? actions.onUnstage(chip.proposal_id) : actions.onStage(chip))}
              title={staged ? "Take it out of the tray" : "Put it in the tray; the slider below sends it"}
            >
              {staged ? (
                <>
                  <Check size={12} strokeWidth={3} /> Staged
                </>
              ) : (
                "Stage"
              )}
            </button>
            <button
              type="button"
              className={dk.iconBtn}
              disabled={actions.busy}
              onClick={() => actions.onDismiss(chip)}
              aria-label="Dismiss this move"
              title="Dismiss: the chip goes for good"
            >
              <X size={13} />
            </button>
            <span className={dk.sub}>Nothing is sent until you slide to send</span>
          </>
        ) : (
          <span className={s.chipState} data-state={state}>
            {STATE_LABEL[state]}
            {state === "sent" && chip.sent_at ? ` · ${weekdayTime(chip.sent_at)}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The Week desk's tray, in the AI desk: between the thread and the composer, in
 * flow rather than floating (`trayHost` resets its position). Everything in it —
 * the day columns, ticking a day, the slider that confirms days as it passes them
 * and sends at its end — is the Week desk's component, unchanged.
 */
export function ChipTray({
  days,
  blocked,
  sendingDay,
  onCancelSwap,
  onUndrop,
  onDiscardDay,
  onDiscardAll,
  onSend,
}: {
  days: TrayDay[];
  blocked: string | null;
  sendingDay: number | null;
  onCancelSwap: (day: number) => void;
  onUndrop: (playerId: number) => void;
  onDiscardDay: (day: number) => void;
  onDiscardAll: () => void;
  onSend: (days: number[]) => Promise<void>;
}) {
  if (!days.length) return null;
  return (
    <div className={s.trayHost}>
      <Tray
        days={days}
        blocked={blocked}
        sendingDay={sendingDay}
        onUnstage={() => undefined}
        onUndrop={onUndrop}
        onDiscardDay={onDiscardDay}
        onDiscardAll={onDiscardAll}
        onTiming={() => undefined}
        onCancelSwap={onCancelSwap}
        onSend={onSend}
      />
    </div>
  );
}
