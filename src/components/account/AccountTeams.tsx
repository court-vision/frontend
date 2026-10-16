"use client";

import { Check, Loader2 } from "lucide-react";
import { accountTeamAction, accountTeamLine, seasonLabel, sortAccountTeams } from "@/lib/account";
import type { EspnAccountTeam } from "@/types/connections";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

export function Rows({ n }: { n: number }) {
  return (
    <div className={s.ledgerSkel} style={{ padding: "4px 0" }} aria-busy>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={dk.skel} style={{ width: `${88 - i * 9}%` }} />
      ))}
    </div>
  );
}

/**
 * The teams ESPN lists on a connected account: one click adds; the tracked ones
 * open instead; a league's renewal of a team saved last season rolls that team
 * over to it.
 */
export function AccountTeamList({
  loading,
  error,
  teams,
  busy,
  onAdd,
  onTracked,
  only,
}: {
  loading: boolean;
  error: string | null;
  teams: readonly EspnAccountTeam[];
  busy: string | null;
  onAdd: (t: EspnAccountTeam) => void;
  onTracked?: (teamId: number) => void;
  /** Leave out the teams already tracked. */
  only?: "untracked";
}) {
  if (loading) return <Rows n={4} />;
  if (error) return <div className={s.formError}>{error}</div>;
  const rows = sortAccountTeams(teams).filter((t) => only !== "untracked" || t.tracked_team_id == null);
  return (
    <div className={s.list}>
      {rows.map((t) => {
        const key = `espn:${t.league_id}:${t.espn_team_id}`;
        const action = accountTeamAction(t);
        const tracked = action === "tracked";
        return (
          <button
            key={`${t.league_id}:${t.espn_team_id}:${t.season}`}
            type="button"
            className={s.item}
            disabled={busy != null || (tracked && !onTracked)}
            title={action === "rollover" ? `Moves the team you saved for an earlier season to ${seasonLabel("espn", t.season)}` : undefined}
            onClick={() => (tracked ? onTracked?.(t.tracked_team_id!) : onAdd(t))}
          >
            <span className={s.itemBody}>
              <span className={s.itemName}>
                <span>{t.team_name}</span>
                {t.team_abbrev ? <span className={dk.sub}>{t.team_abbrev}</span> : null}
              </span>
              <span className={s.itemSub}>{accountTeamLine(t)}</span>
            </span>
            <span className={s.itemRight}>
              {busy === key ? (
                <Loader2 size={13} className={dk.spin} />
              ) : tracked ? (
                <span className={`${dk.chip} ${dk.flat}`}>
                  <Check size={11} /> tracked
                </span>
              ) : (
                <span className={`${dk.btn} ${dk.btnSmall}`}>{action === "rollover" ? "Roll over" : "Add"}</span>
              )}
            </span>
          </button>
        );
      })}
      {rows.length === 0 ? (
        <div className={s.listEmpty}>
          {only === "untracked" ? "Every basketball team ESPN lists on this account is already here." : "ESPN lists no basketball team on this account. A league it does not list can be added by its id."}
        </div>
      ) : null}
    </div>
  );
}
