"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useDeskPortal } from "@/components/desk/DeskFrame";
import dk from "@/components/desk/desk.module.css";
import type { EspnDraftSync } from "@/hooks/useEspnDraftSync";
import { canDraftLabel, chipStatus } from "@/lib/espn-draft/sync-state";
import s from "./draft.module.css";

/**
 * The Draft Tap, in one pill: whether picks are flowing from ESPN, and the
 * controls for when they are not. Absent where the tap cannot be talking to
 * this room at all.
 */
export function SyncPill({ sync, onLink }: { sync: EspnDraftSync; onLink: () => void }) {
  const container = useDeskPortal();
  const [open, setOpen] = useState(false);
  const chip = chipStatus(sync.state, sync.paused);
  const st = sync.state;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={s.syncPill} data-tone={chip.tone} title={chip.detail ?? undefined}>
          <span className={s.syncDot} />
          {chip.label}
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content className={dk.menu} align="end" sideOffset={6} style={{ width: 320 }}>
          <div className={dk.menuHead}>
            <span className={dk.menuTitle}>ESPN sync</span>
            <span className={dk.sub}>{chip.detail ?? "Picks made in the ESPN room arrive here through the Draft Tap."}</span>
          </div>
          <dl className={s.kv}>
            <dt>ESPN room</dt>
            <dd>{st.room?.leagueId ?? "—"}</dd>
            <dt>Your ESPN team</dt>
            <dd>{st.myTeamId ?? "—"}</dd>
            <dt>Picks synced</dt>
            <dd>{st.stats.picks}</dd>
            <dt>Sent from here</dt>
            <dd>
              {st.stats.sent}
              {st.stats.sendFailed ? ` · ${st.stats.sendFailed} failed` : ""}
            </dd>
            {st.stats.conflicts ? (
              <>
                <dt>Conflicts</dt>
                <dd style={{ color: "var(--down)" }}>{st.stats.conflicts}</dd>
              </>
            ) : null}
            <dt>Draft from here</dt>
            <dd style={{ color: sync.canDraft.ok ? "var(--up)" : "var(--text-3)" }}>{sync.canDraft.ok ? "ready" : canDraftLabel(sync.canDraft.reason)}</dd>
          </dl>
          <div className={dk.dialogFoot} style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            {sync.unbound && !sync.unbound.dismissed ? (
              <>
                <button type="button" className={`${dk.btn} ${dk.btnSmall} ${dk.btnPrimary}`} onClick={onLink}>
                  Link to ESPN room {sync.unbound.espnLeagueId}
                </button>
                <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={sync.ignoreRoom}>
                  Ignore
                </button>
              </>
            ) : null}
            {sync.paused || st.reset ? (
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={sync.resume}>
                Resume
              </button>
            ) : (
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => sync.setPaused(true)}>
                Pause
              </button>
            )}
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={sync.reconnect}>
              Reconnect
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
