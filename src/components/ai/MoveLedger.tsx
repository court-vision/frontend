"use client";

import { useState } from "react";
import Link from "next/link";
import { DeskDialog } from "@/components/desk/DeskDialog";
import { SCOUT_DESK } from "@/components/desk/routes";
import { SegRail } from "@/components/desk/SegRail";
import type { DeskTeam } from "@/components/desk/TeamSwitch";
import { aiMessage, useMoveOutcomesQuery } from "@/hooks/useAi";
import { toApiError } from "@/lib/api-error";
import { statLabel } from "@/lib/category-format";
import {
  forecastChange,
  sideText,
  signed,
  SOURCE_LABELS,
  summaryText,
  WINDOW_LABELS,
  windowOf,
  windowResult,
} from "@/lib/dime";
import { focusToSearch } from "@/lib/scout";
import type { MoveOutcome, MoveOutcomePlayer, MoveScope, MoveWindowName } from "@/types/ai";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

const SCOPES: Array<{ id: MoveScope; label: string }> = [
  { id: "team", label: "Your moves" },
  { id: "league", label: "Whole league" },
];
const WINDOWS: MoveWindowName[] = ["day", "matchup", "two_weeks"];

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * "How moves went": the move ledger for one team (or its whole league). Every
 * add and drop read off the nightly rosters, who made it, and what it earned in
 * the box scores with the league's scoring over the day it counted, the rest of
 * that matchup and two weeks. What Dime reads with `get_move_outcomes`.
 */
export function MoveLedgerDialog({
  open,
  onOpenChange,
  teams,
  teamId,
  onTeam,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: DeskTeam[];
  teamId: number | null;
  onTeam: (id: number) => void;
}) {
  const [scope, setScope] = useState<MoveScope>("team");
  // No team picked yet (the desk's selection is empty): read the first one, the
  // one the team picker shows, rather than saying there are no teams.
  const team = teamId ?? teams[0]?.id ?? null;
  const ledger = useMoveOutcomesQuery(team, scope, open);
  const data = ledger.data;
  const espnOnly = ledger.isError && toApiError(ledger.error).code === "MOVE_LEDGER_NOT_FOUND";
  const fmt = data?.format ?? "points";

  return (
    <DeskDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="How moves went"
      description={
        fmt === "categories"
          ? "Adds and drops, newest first, read off the rosters each night, and how the added player did against the dropped one in your league's categories: the day it counted, the rest of that matchup, and two weeks."
          : "Adds and drops, newest first, read off the rosters each night, and what each earned with your league's scoring: the added player's points minus the dropped one's, for the day it counted, the rest of that matchup, and two weeks."
      }
      cancelLabel="Close"
    >
      <div className={s.noteFormRow}>
        {teams.length > 1 ? (
          <select className={s.select} aria-label="Team" value={team ?? ""} onChange={(e) => onTeam(Number(e.target.value))}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}
        <span className={dk.spacer} />
        <SegRail label="Whose moves" active={scope}>
          {SCOPES.map((sc) => {
            const on = scope === sc.id;
            return (
              <button key={sc.id} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} onClick={() => setScope(sc.id)}>
                <span className={dk.segLabel}>{sc.label}</span>
              </button>
            );
          })}
        </SegRail>
      </div>

      {team == null ? (
        <div className={s.rowEmpty}>Add a team to see how its moves went.</div>
      ) : ledger.isLoading ? (
        <div className={s.noteList} aria-busy>
          <span className={dk.skel} style={{ width: "70%" }} />
          <span className={dk.skel} style={{ width: "90%" }} />
          <span className={dk.skel} style={{ width: "50%" }} />
        </div>
      ) : espnOnly ? (
        <div className={s.rowEmpty}>Moves are tracked for ESPN teams for now.</div>
      ) : ledger.isError ? (
        <div className={s.rowEmpty}>{aiMessage(ledger.error, "Couldn't read the moves")}</div>
      ) : !data || data.moves.length === 0 ? (
        <div className={s.rowEmpty}>No moves yet. They show up the morning after they count.</div>
      ) : (
        <>
          <div className={s.ledgerSummary}>
            {data.summary.map((row) => (
              <div key={row.source} className={s.ledgerSummaryRow}>
                <span className={s.sourceTag} data-source={row.source}>
                  {SOURCE_LABELS[row.source]}
                </span>
                <span>{summaryText(row)}</span>
              </div>
            ))}
            <span className={dk.sub}>Settled means its two weeks are over. Results in grey are still being played.</span>
          </div>
          <div className={s.noteList}>
            {data.moves.map((m) => (
              <MoveRow key={m.move_id} move={m} league={scope === "league"} categories={fmt === "categories"} />
            ))}
          </div>
          {data.total > data.moves.length ? (
            <span className={dk.sub}>
              The newest {data.moves.length} of {data.total} moves.
            </span>
          ) : null}
        </>
      )}
    </DeskDialog>
  );
}

function Player({ player, sign }: { player: MoveOutcomePlayer | null | undefined; sign: "+" | "−" }) {
  if (!player) return null;
  const name = player.name ?? "Unknown player";
  return (
    <span className={s.movePlayer} data-sign={sign === "+" ? "add" : "drop"}>
      <span aria-hidden>{sign}</span>{" "}
      {player.player_id != null ? (
        <Link href={`${SCOUT_DESK}${focusToSearch({ kind: "player", id: player.player_id })}`} className={dk.link}>
          {name}
        </Link>
      ) : (
        name
      )}
    </span>
  );
}

function MoveRow({ move, league, categories }: { move: MoveOutcome; league: boolean; categories: boolean }) {
  const twoWeeks = windowOf(move, "two_weeks");
  const held = typeof move.windows?.held_through === "string" ? (move.windows.held_through as string) : null;
  const forecast = forecastChange(move);
  return (
    <div className={s.moveRow}>
      <div className={s.noteHead}>
        <span className={dk.sub}>{shortDate(move.date)}</span>
        <span className={s.sourceTag} data-source={move.source}>
          {SOURCE_LABELS[move.source]}
        </span>
        {league ? <span className={move.mine ? s.moveTeamMine : dk.sub}>{move.team_name}</span> : null}
        <span className={dk.spacer} />
        <div className={s.moveResults}>
          {WINDOWS.map((name) => {
            const w = windowOf(move, name);
            const result = windowResult(w);
            return (
              <span key={name} className={s.moveResult} title={w ? `${w.start} to ${w.end}${w.complete ? "" : ", still being played"}` : undefined}>
                <span className={dk.sub}>{WINDOW_LABELS[name]}</span>
                <span className={`${dk.chip} ${result ? dk[result.tone] : dk.flat}`} data-open={w && !w.complete ? "" : undefined}>
                  {result?.text ?? "–"}
                </span>
              </span>
            );
          })}
        </div>
      </div>
      <div className={s.movePlayers}>
        <Player player={move.add} sign="+" />
        <Player player={move.drop} sign="−" />
      </div>
      <div className={s.moveDetail}>
        {twoWeeks?.add ? <span>Added: {sideText(twoWeeks.add, true)}</span> : null}
        {twoWeeks?.drop ? <span>Dropped: {sideText(twoWeeks.drop)}</span> : null}
        {move.add && held ? <span>Kept through {shortDate(held)}</span> : null}
        {categories && twoWeeks?.edge ? (
          <span>
            Won {twoWeeks.edge.won.map(statLabel).join(", ") || "none"} · lost {twoWeeks.edge.lost.map(statLabel).join(", ") || "none"}
          </span>
        ) : null}
      </div>
      {move.source === "dime" && (forecast != null || move.reason) ? (
        <div className={s.chipReason}>
          {forecast != null ? (
            <span>
              Dime forecast {categories ? `${signed(forecast, 0)} categories` : `${signed(forecast)} pts`} this matchup.{" "}
            </span>
          ) : null}
          {move.reason}
        </div>
      ) : null}
    </div>
  );
}
