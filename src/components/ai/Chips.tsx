"use client";

import { Check, X } from "lucide-react";
import { changeLabel, chipState, patchChip, type ChipPatch } from "@/lib/ai-proposals";
import { applyLabel, daySpan, doneLabel, holdLine, holdTag, isSteering, shortDay, steerHow } from "@/lib/steering";
import { monthDay, weekdayTime } from "@/components/week/format";
import { Tray, type TrayDay } from "@/components/week/Tray";
import type { AiProposalChip, AiProposalMove } from "@/types/ai";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/**
 * A chip: a move the agent proposed and the server checked (backend
 * services/ai/proposals.py): an add / drop, or a day's slot moves (a lineup
 * chip). "Stage" puts it in the tray under the thread; the tray is the Week
 * desk's own (`Tray` + `SlideToSend`), and its slider sends the move through
 * the Week desk's writes. The chip itself never sends anything.
 *
 * Dime's steering chips (holds, a lane's start / pause / resume / stop, a
 * pickup's cancel; lib/steering.ts) change no ESPN roster, so they skip the
 * tray: their Apply button calls the Week desk's own route for the chip.
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
  /** Apply a steering chip (holds, a lane, a pickup's cancel) through the Week desk's route for it. */
  onApply: (chip: AiProposalChip) => void;
  /** The steering chip being applied, while that request is out. */
  applying: number | null;
}

/** start / bench / shift, as the move's glyph. */
const ROLE_SIGN: Record<AiProposalMove["role"], string> = { start: "▲", bench: "▼", shift: "→" };

const STATE_LABEL: Record<"sent" | "dismissed" | "expired" | "shadow", string> = {
  sent: "Sent",
  dismissed: "Dismissed",
  expired: "Expired",
  shadow: "A review: logged, not sent",
};

export function ProposalChip({ chip: raw, actions }: { chip: AiProposalChip; actions: ChipActions }) {
  const chip = patchChip(raw, actions.patches);
  if (isSteering(chip)) return <SteeringChip chip={chip} actions={actions} />;
  const state = chipState(chip);
  const staged = state === "proposed" && actions.stagedIds.has(chip.proposal_id);
  const when = chip.kind === "transaction" ? "Today" : `${chip.dow} ${monthDay(chip.date)}`;
  const shadow = state === "shadow";
  const how = shadow
    ? "what Dime would have done in a check-in"
    : chip.kind === "scheduled"
      ? "scheduled: made for you ahead of that day's games"
      : chip.kind === "lineup"
        ? "lineup: set on ESPN when you send it"
        : "goes to ESPN when you send it";
  const change = changeLabel(chip);
  const tone = chip.change == null ? dk.flat : chip.change > 0.05 ? dk.up : chip.change < -0.05 ? dk.down : dk.flat;
  const changeTitle =
    chip.kind === "lineup" ? "Projected change for the day" : chip.scoring === "categories" ? "Projected change in category wins" : "Projected change to your week";
  return (
    <div className={s.chip} data-state={state} data-staged={staged || undefined} role="group" aria-label={chip.kind === "lineup" ? "Proposed lineup" : "Proposed move"}>
      <div className={s.chipHead}>
        <span className={dk.label}>{shadow ? "Dime would" : "CV AI proposes"}</span>
        <span>
          {when} · {how}
        </span>
      </div>
      <div className={s.chipMove}>
        {chip.kind === "lineup" ? (
          <ul className={s.chipMoves}>
            {chip.moves.map((m) => (
              <li key={m.espn_id} data-role={m.role}>
                <b className={s.chipSign}>{ROLE_SIGN[m.role]}</b>
                {m.name}
                <span className={s.chipTeam}>
                  {m.from_slot} → {m.to_slot}
                  {m.note ? ` · ${m.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
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
          <span className={`${dk.chip} ${tone}`} title={changeTitle}>
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

/** What a steering chip does, a line each: the holds it sets and clears, the lane step, the pickup. */
function SteeringBody({ chip }: { chip: AiProposalChip }) {
  if (chip.kind === "steer" && chip.steer) {
    return (
      <ul className={s.chipMoves}>
        {chip.steer.holds.map((h) => (
          <li key={`${h.kind}-${h.player.espn_id}`} title={h.effect}>
            <b className={s.chipSign}>{holdTag(h.kind, h.share)}</b>
            {holdLine(h)}
          </li>
        ))}
        {chip.steer.clear.map((h) => (
          <li key={`clear-${h.hold_id}`} title={`Set for: ${h.reason}`}>
            <b className={s.chipSign}>×</b>
            Clear the {h.kind} on {h.player.name}
            <span className={s.chipTeam}>{daySpan(h.starts_on, h.ends_on)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (chip.kind === "lane" && chip.lane) {
    const a = chip.lane;
    const verb = a.op === "start" ? "Stream" : a.op === "pause" ? "Pause the lane on" : a.op === "resume" ? "Resume the lane on" : "Stop the lane on";
    return (
      <span>
        <b className={s.chipSign}>{a.op === "start" ? "↻" : a.op === "stop" ? "■" : a.op === "pause" ? "Ⅱ" : "▶"}</b>
        {verb} {a.holder.name}&apos;s spot
        <span className={s.chipTeam}>through {shortDay(a.end_date)}</span>
        {a.op === "start" && a.adds != null ? <span className={dk.sub}>{a.adds} add{a.adds === 1 ? "" : "s"}</span> : null}
      </span>
    );
  }
  if (chip.kind === "cancel_pickup" && chip.pickup) {
    const p = chip.pickup;
    return (
      <span>
        <b className={s.chipSign}>×</b>
        Cancel + {p.add.name}
        {p.drop ? <span className={s.chipTeam}>for {p.drop.name}</span> : null}
        <span className={dk.sub}>
          {shortDay(p.date)}
          {p.lane_id != null ? " · a stream lane's" : ""}
        </span>
      </span>
    );
  }
  return <span className={dk.sub}>{chip.summary}</span>;
}

/**
 * One of Dime's steering chips: what it changes in an automation and why, with
 * Apply (the Week desk's route for it, `proposal_id` on the request) and Dismiss.
 */
function SteeringChip({ chip, actions }: { chip: AiProposalChip; actions: ChipActions }) {
  const state = chipState(chip);
  const shadow = state === "shadow";
  const applying = actions.applying === chip.proposal_id;
  const gain = chip.kind === "lane" && chip.lane?.op === "start" ? chip.lane.gain : null;
  const tone = gain == null ? dk.flat : gain > 0.05 ? dk.up : gain < -0.05 ? dk.down : dk.flat;
  return (
    <div className={s.chip} data-state={state} role="group" aria-label="Proposed change to an automation">
      <div className={s.chipHead}>
        <span className={dk.label}>{shadow ? "Dime would" : "Dime proposes"}</span>
        <span>
          {chip.dow} {monthDay(chip.date)} · {shadow ? "what Dime would have done in a check-in" : steerHow(chip)}
        </span>
      </div>
      <div className={s.chipMove}>
        <SteeringBody chip={chip} />
        {gain != null ? (
          <span className={`${dk.chip} ${tone}`} title="Projected gain over keeping the spot's player">
            {changeLabel({ change: gain, scoring: null })}
          </span>
        ) : null}
      </div>
      <div className={s.chipReason}>{chip.reason}</div>
      <div className={s.chipFoot}>
        {state === "proposed" ? (
          <>
            <button
              type="button"
              className={`${dk.btn} ${dk.btnSmall} ${dk.btnPrimary}`}
              disabled={actions.applying != null}
              onClick={() => actions.onApply(chip)}
              title="Apply it: the Week desk makes this change now"
            >
              {applying ? "Applying…" : applyLabel(chip)}
            </button>
            <button
              type="button"
              className={dk.iconBtn}
              disabled={applying}
              onClick={() => actions.onDismiss(chip)}
              aria-label="Dismiss this change"
              title="Dismiss: the chip goes for good"
            >
              <X size={13} />
            </button>
            <span className={dk.sub}>Nothing changes until you apply it</span>
          </>
        ) : (
          <span className={s.chipState} data-state={state}>
            {state === "sent" ? doneLabel(chip) : STATE_LABEL[state]}
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
  onUnstageMove,
  onDiscardDay,
  onDiscardAll,
  onSend,
}: {
  days: TrayDay[];
  blocked: string | null;
  sendingDay: number | null;
  onCancelSwap: (day: number) => void;
  onUndrop: (playerId: number) => void;
  /** The × on a lineup move: the whole lineup chip leaves the tray (it is one write). */
  onUnstageMove: (day: number, playerId: number) => void;
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
        onUnstage={onUnstageMove}
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
