"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { userMessage } from "@/lib/api-error";
import type { LaneNotify, StreamLanePlan } from "@/types/stream-lane";
import { Headshot } from "@/components/desk/Headshot";
import { monthDay, pts, shortName, signed, whenTime } from "./format";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

interface LaneSheetProps {
  /** The spot's player; null keeps the sheet closed. */
  player: { id: number; name: string } | null;
  container: HTMLElement | null;
  demo: boolean;
  onClose: () => void;
  /** The projection for his spot (a dry run). */
  load: () => Promise<StreamLanePlan>;
  onStart: (notify: LaneNotify, plan: StreamLanePlan) => Promise<"ok" | "refused">;
  starting: boolean;
  error: string | null;
}

/**
 * Setting up a stream lane: what the lane would do with the spot if nobody else
 * touched the market, said plainly to be a projection, and how it tells you.
 */
export function LaneSheet({ player, container, demo, onClose, load, onStart, starting, error }: LaneSheetProps) {
  const open = player != null;
  const [plan, setPlan] = useState<StreamLanePlan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notify, setNotify] = useState<LaneNotify>("email");

  // A fresh projection each time the sheet opens on a player.
  const playerId = player?.id ?? null;
  useEffect(() => {
    if (playerId == null) return;
    let live = true;
    setPlan(null);
    setLoadError(null);
    load().then(
      (p) => live && setPlan(p),
      (err) => live && setLoadError(userMessage(err, "Couldn't plan this spot"))
    );
    return () => {
      live = false;
    };
    // `load` is rebuilt every render upstream; the player is what asks for a new plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  const proj = plan?.projection ?? null;
  const short = player ? shortName(player.name) : "";
  const lastDay = proj?.days[proj.days.length - 1];
  const addsLine = proj
    ? `${proj.adds} add${proj.adds === 1 ? "" : "s"}${proj.adds_left != null ? ` of ${proj.adds_left} left` : ""}`
    : "";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className={dk.overlay} />
        <Dialog.Content className={`${dk.dialog} ${dk.dialogWide}`}>
          <div className={dk.dialogBody}>
            <Dialog.Title className={dk.dialogTitle}>
              Stream {short}&apos;s spot{lastDay ? ` through ${dowOf(lastDay.nba_date)}` : ""}
            </Dialog.Title>
            <Dialog.Description className={dk.dialogText}>
              Before each day&apos;s games the lane re-checks the free agents and your adds, and makes the best move
              for the rest of the matchup: it brings in a free agent on days one adds more than whoever holds the spot,
              and keeps him otherwise. Below is the plan if nobody else touched the market. It will change as the market
              does.
            </Dialog.Description>

            {loadError ? <span className={dk.error}>{loadError}</span> : null}
            {!proj && !loadError ? <div className={s.laneSheetEmpty}>Planning the rest of the matchup…</div> : null}
            {proj ? (
              <>
                <div className={s.laneSheetDays} role="table" aria-label="The projection, day by day">
                  {proj.days.map((d) => (
                    <div key={d.nba_date} className={s.laneSheetDay} role="row" data-switch={d.switch}>
                      <span className={s.laneSheetDow} role="cell">
                        {dowOf(d.nba_date).toUpperCase()} {monthDay(d.nba_date)}
                      </span>
                      <span className={s.laneSheetWho} role="cell">
                        <Headshot nbaId={d.player.nba_player_id ?? null} name={d.player.name} size={22} />
                        <span className={s.name}>{d.player.name}</span>
                        <span className={dk.sub}>{d.player.team}</span>
                      </span>
                      <span className={s.laneSheetTag} role="cell">
                        {d.switch ? "PICK UP" : d.player.player_id === plan!.holder.player_id ? "KEEP" : ""}
                      </span>
                      <span className={`${s.laneSheetValue} ${dk.mono}`} role="cell">
                        {d.value > 0 ? `+${pts(d.value)}` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={s.laneSheetSum}>
                  <span className={`${dk.chip} ${proj.gain > 0.05 ? dk.up : dk.flat}`}>{signed(proj.gain)}</span>
                  <span className={dk.sub}>
                    over keeping {short} · {addsLine} · first decision {whenTime(plan!.first_decision_at)}
                    {demo ? " · demo: planned in the browser, cruder than the real one" : ""}
                  </span>
                </div>
                <fieldset className={s.laneNotify}>
                  <legend className={dk.label}>Tell me</legend>
                  <label>
                    <input type="radio" name="lane-notify" checked={notify === "email"} onChange={() => setNotify("email")} />
                    Email me each move it makes, and if it can&apos;t act
                  </label>
                  <label>
                    <input type="radio" name="lane-notify" checked={notify === "desk"} onChange={() => setNotify("desk")} />
                    Desk only: no emails
                  </label>
                </fieldset>
              </>
            ) : null}
            {error ? <span className={dk.error}>{error}</span> : null}
          </div>
          <div className={dk.dialogFoot}>
            <Dialog.Close asChild>
              <button type="button" className={dk.btn}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={`${dk.btn} ${dk.btnPrimary}`}
              disabled={!plan || starting}
              onClick={() => {
                if (!plan) return;
                void onStart(notify, plan).then((outcome) => outcome === "ok" && onClose());
              }}
            >
              {starting ? "Starting…" : "Start streaming"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function dowOf(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}
