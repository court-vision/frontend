"use client";

import { useMemo } from "react";
import { Headshot } from "@/components/desk/Headshot";
import dk from "@/components/desk/desk.module.css";
import { needBar, needsByUrgency, paceLabel } from "@/lib/draft-board";
import {
  capStatuses,
  congestionSummary,
  fillLineup,
  myRoster,
  openStartingSlots,
  stacksFrom,
  type KeeperStatus,
} from "@/lib/draft-roster";
import type { DraftBoardResult, DraftRecommendation, DraftSession } from "@/types/draft";
import { big, ordinal, shortName, signed } from "./format";
import s from "./draft.module.css";

// ---------------------------------------------------------------------------
// Calls: the recommendations, with the score taken apart
// ---------------------------------------------------------------------------

interface CallsProps {
  recommendations: DraftRecommendation[];
  onTheClock: boolean;
  nextPick: number | null;
  activeId: number | null;
  onFocus: (playerId: number) => void;
  onTake: (rec: DraftRecommendation) => void;
  onEspn?: (rec: DraftRecommendation) => void;
  espnDisabled: string | null;
  marking: boolean;
  loading: boolean;
}

const TERM_COLOR: Record<string, string> = {
  vorp: "var(--accent)",
  category_fit: "var(--preview)",
};

export function Calls({ recommendations, onTheClock, nextPick, activeId, onFocus, onTake, onEspn, espnDisabled, marking, loading }: CallsProps) {
  const max = Math.max(1, ...recommendations.map((r) => Math.max(r.score, r.vorp)));
  return (
    <section className={s.section} aria-label="Calls">
      <div className={s.sectionHead}>
        <span className={dk.label} style={onTheClock ? { color: "var(--accent)" } : undefined}>
          {onTheClock ? "Your call" : "Calls"}
        </span>
        <span className={dk.sub}>{nextPick != null ? `for pick ${nextPick}` : "best available"}</span>
        <span className={s.right}>
          <span className={dk.sub} title="Value over replacement, less injury risk, lineup congestion and punted categories — in season-value points">
            room score
          </span>
        </span>
      </div>
      {loading && recommendations.length === 0 ? (
        <div className={s.sectionBody}>
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className={dk.skel} style={{ display: "block", margin: "14px 0", opacity: 1 - i * 0.2 }} />
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className={s.sectionBody}>
          <span className={dk.sub}>No calls: nobody left to recommend.</span>
        </div>
      ) : (
        recommendations.slice(0, 5).map((rec, i) => {
          const top = i === 0;
          const penalty = rec.components.filter((c) => c.in_score && c.key !== "vorp" && c.value < 0).reduce((a, c) => a + c.value, 0);
          const fit = rec.components.find((c) => c.key === "category_fit")?.value ?? 0;
          return (
            <div
              key={rec.player_id}
              className={s.call}
              data-top={top}
              data-active={rec.player_id === activeId}
              onClick={() => onFocus(rec.player_id)}
              title={rec.components.map((c) => `${c.label}: ${signed(c.value)}${c.detail ? ` — ${c.detail}` : ""}`).join("\n")}
            >
              <span className={s.callRank}>{i + 1}</span>
              <Headshot nbaId={rec.player_id} name={rec.name} size={32} />
              <span style={{ minWidth: 0 }}>
                <div className={s.callName}>{top ? rec.name : shortName(rec.name)}</div>
                <div className={s.callMeta}>
                  {rec.primary_position ?? "—"} · ESPN {rec.market_rank != null ? `#${rec.market_rank}` : "unranked"} · CV {rec.cv_rank != null ? `#${rec.cv_rank}` : "—"}
                </div>
              </span>
              <span className={s.callScore}>{signed(rec.score, 0)}</span>
              <span className={s.callBar} aria-hidden>
                <span style={{ width: `${(Math.max(0, rec.score) / max) * 100}%`, background: TERM_COLOR.vorp }} />
                {penalty < 0 ? <span style={{ width: `${(-penalty / max) * 100}%`, background: "var(--down)", opacity: 0.7 }} /> : null}
                {fit > 0 ? <span style={{ width: `${(fit / max) * 100}%`, background: TERM_COLOR.category_fit, opacity: 0.8 }} /> : null}
              </span>
              {top ? (
                <>
                  <span className={s.terms}>
                    {rec.components.map((c) => (
                      <TermLine key={c.key} label={c.label} value={c.value} inScore={c.in_score} />
                    ))}
                  </span>
                  <span className={s.callReason}>{rec.reason}</span>
                  <span className={s.callActs} onClick={(e) => e.stopPropagation()}>
                    <button type="button" className={`${dk.btn} ${dk.btnSmall} ${dk.btnPrimary}`} disabled={marking} onClick={() => onTake(rec)}>
                      Take {shortName(rec.name)}
                    </button>
                    {onEspn ? (
                      <button type="button" className={`${dk.btn} ${dk.btnSmall}`} disabled={!!espnDisabled} title={espnDisabled ?? "Send this pick to ESPN"} onClick={() => onEspn(rec)}>
                        Draft on ESPN
                      </button>
                    ) : null}
                  </span>
                </>
              ) : null}
            </div>
          );
        })
      )}
    </section>
  );
}

function TermLine({ label, value, inScore }: { label: string; value: number; inScore: boolean }) {
  return (
    <>
      <span style={inScore ? undefined : { fontStyle: "italic" }}>{label}</span>
      <span style={{ color: value > 0.05 ? (inScore ? "var(--text)" : "var(--text-2)") : value < -0.05 ? "var(--down)" : "var(--text-3)" }}>
        {inScore || value === 0 ? signed(value, 0) : big(value)}
      </span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Roster: the lineup the picks fill, caps, stacks, keepers
// ---------------------------------------------------------------------------

interface RosterProps {
  session: DraftSession;
  board: DraftBoardResult | null;
  keepers: KeeperStatus[];
  onEditKeepers: () => void;
  onRecordKeepers: () => void;
  recordingKeepers: boolean;
  onUndo: ((overall: number) => void) | null;
  canUndo: (overall: number) => boolean;
}

export function Roster({ session, board, keepers, onEditKeepers, onRecordKeepers, recordingKeepers, onUndo, canUndo }: RosterProps) {
  const players = useMemo(() => myRoster(board?.roster ?? [], session.picks), [board, session.picks]);
  const meta = board?.meta ?? null;
  const lineup = useMemo(() => fillLineup(meta?.roster_slots ?? {}, players), [meta, players]);
  const open = openStartingSlots(lineup);
  const caps = capStatuses(players, meta?.position_limits ?? {});
  const stacks = stacksFrom(meta?.congestion, players);
  const congestion = congestionSummary(meta?.congestion);
  const pending = keepers.filter((k) => !k.recorded && k.blocker === null);
  const allowance = session.keeper_count ?? 0;
  return (
    <section className={s.section} aria-label="Your roster">
      <div className={s.sectionHead}>
        <span className={dk.label}>Roster</span>
        <span className={dk.sub}>
          {players.length}
          {session.rounds ? ` / ${session.rounds}` : ""}
        </span>
        <span className={s.right}>
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onEditKeepers} title={allowance ? `Your league allows ${allowance}` : "Players kept from last season, and the round each costs"}>
            Keepers {keepers.length ? <span className={dk.sub}>{keepers.length}</span> : null}
          </button>
        </span>
      </div>
      <div className={s.sectionBody}>
        {lineup.slots.length === 0 ? (
          <span className={dk.sub}>This room has no lineup slots to fill.</span>
        ) : (
          <div className={s.slots}>
            {lineup.slots.map((slot, i) => {
              const p = slot.player;
              return (
                <div key={`${slot.slot}-${i}`} className={s.slot} data-bench={slot.slot === "BE"} data-open={!p}>
                  <span className={s.slotChip}>{slot.slot}</span>
                  <span className={s.slotName}>{p ? p.name : "open"}</span>
                  <span className={s.slotPick}>
                    {p?.keeper ? "K · " : ""}
                    {p?.overall_pick != null ? (
                      onUndo && canUndo(p.overall_pick) ? (
                        <button
                          type="button"
                          className={dk.link}
                          style={{ background: "none", border: 0, font: "inherit", cursor: "pointer", padding: 0 }}
                          onClick={() => onUndo(p.overall_pick!)}
                          title={`Undo pick ${p.overall_pick}`}
                        >
                          #{p.overall_pick}
                        </button>
                      ) : (
                        `#${p.overall_pick}`
                      )
                    ) : (
                      ""
                    )}
                  </span>
                </div>
              );
            })}
            {lineup.overflow.map((p) => (
              <div key={p.player_id} className={s.slot}>
                <span className={s.slotChip} style={{ color: "var(--warn)" }}>+</span>
                <span className={s.slotName}>{p.name}</span>
                <span className={s.slotPick}>no slot</span>
              </div>
            ))}
          </div>
        )}
        <div className={s.facts}>
          {open.length ? (
            <span className={s.fact} title="Starting slots still empty">
              open {open.map((o) => (o.open > 1 ? `${o.slot}×${o.open}` : o.slot)).join(" ")}
            </span>
          ) : players.length ? (
            <span className={s.fact}>starters filled</span>
          ) : null}
          {caps.map((c) => (
            <span key={c.position} className={s.fact} data-over={c.count >= c.limit} title={`At most ${c.limit} ${c.position} by primary position`}>
              {c.position} {c.count}/{c.limit}
            </span>
          ))}
          {stacks.slice(0, 3).map((st) => (
            <span key={st.team} className={s.fact} title={`${st.count} of your players share ${st.team}'s schedule`}>
              {st.team} ×{st.count}
            </span>
          ))}
          {congestion && players.length ? (
            <span className={s.fact} title={congestion.title} style={congestion.tone === "muted" ? { color: "var(--text-3)" } : undefined}>
              {congestion.label}
            </span>
          ) : null}
        </div>
        {keepers.length ? (
          <div style={{ marginTop: 12 }}>
            {keepers.map((k) => (
              <div key={`${k.keeper.player_id ?? k.keeper.name}`} className={s.keeper}>
                <span className={dk.grow}>{k.keeper.name ?? `#${k.keeper.player_id}`}</span>
                <span className={dk.sub}>
                  {k.recorded ? "recorded" : k.blocker ? k.blocker : `R${k.keeper.round} · #${k.keeper.overall_pick}`}
                </span>
              </div>
            ))}
            {pending.length ? (
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} style={{ marginTop: 6 }} disabled={recordingKeepers} onClick={onRecordKeepers}>
                {recordingKeepers ? "Recording…" : `Record ${pending.length} keeper${pending.length === 1 ? "" : "s"}`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Needs: where the roster stands in each category (category leagues)
// ---------------------------------------------------------------------------

export function Needs({ board, onPunt, saving }: { board: DraftBoardResult | null; onPunt: ((key: string) => void) | null; saving: boolean }) {
  const meta = board?.meta ?? null;
  const needs = needsByUrgency(meta);
  if (!meta || meta.value_kind !== "cat_value" || needs.length === 0) return null;
  const pace = paceLabel(meta);
  return (
    <section className={s.section} aria-label="Category needs">
      <div className={s.sectionHead}>
        <span className={dk.label}>Needs</span>
        <span className={dk.sub} title="Bars run left when your roster is behind an average team after as many picks, right when ahead">
          {pace ?? ""}
        </span>
      </div>
      <div className={s.sectionBody}>
        {needs.map((n) => {
          const bar = needBar(n.need);
          const width = `${bar.share * 50}%`;
          return (
            <div key={n.key} className={s.need} data-punted={n.punted} title={`Your roster ${n.mine.toFixed(2)} vs pace ${n.pace.toFixed(2)} (z); fit weighs it ×${n.weight}`}>
              <span className={s.needLabel}>{n.label}</span>
              <span className={s.needTrack}>
                {bar.share > 0 ? (
                  <span
                    className={s.needFill}
                    style={
                      bar.side === "behind"
                        ? { right: "50%", width, background: "var(--down)", opacity: n.punted ? 0.3 : 0.8 }
                        : { left: "50%", width, background: "var(--up)", opacity: n.punted ? 0.3 : 0.8 }
                    }
                  />
                ) : null}
              </span>
              <span className={s.needRank}>{n.my_rank != null && n.seats ? `${ordinal(n.my_rank)}/${n.seats}` : "—"}</span>
              {onPunt ? (
                <button type="button" className={s.puntBtn} aria-pressed={n.punted} disabled={saving} onClick={() => onPunt(n.key)} title={n.punted ? "Stop punting" : "Punt: it weighs zero in fit and the calls"}>
                  {n.punted ? "PUNTED" : "PUNT"}
                </button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
