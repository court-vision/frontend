"use client";

import { CalendarDays, ChevronLeft, ChevronRight, MessagesSquare } from "lucide-react";
import dk from "@/components/desk/desk.module.css";
import { pts, shortName, signed, tip } from "@/components/week/format";
import { COVER_WORD, STATE_WORD, benchPlaying, nextWord, untilText, type CountPart, type Duel, type DuelCell, type LastCheckin } from "@/lib/home";
import { localClock, localizeEtClocks, localizeProseClocks, localWeekdayTime } from "@/lib/local-time";
import type { AutomationLevel, OverviewItem, TeamOverview } from "@/types/team-overview";
import s from "./home.module.css";

/** A team's two doors: its Week desk and Dime. `from` is what grows into the desk. */
export interface Doors {
  week: (team: TeamOverview, from: HTMLElement | null) => void;
  dime: (team: TeamOverview, from: HTMLElement | null, conversationId?: number | null) => void;
  /** What the mark under the pointer opens, for the status line; null when the pointer leaves. */
  hint: (text: string | null) => void;
}

const LEVEL_WORD: Record<AutomationLevel, string> = { off: "Off", notify: "Notify", act: "Act", ai: "AI" };

/** The Week and Dime marks: at a row's end, and in the header of a team's page on a phone. */
export function DoorMarks({
  team,
  doors,
  from,
  dimeFrom = from,
  large = false,
}: {
  team: TeamOverview;
  doors: Doors;
  /** What grows into the Week desk. */
  from: () => HTMLElement | null;
  /** What grows into Dime, when it is not the same thing. */
  dimeFrom?: () => HTMLElement | null;
  large?: boolean;
}) {
  const mark = (label: string, open: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      className={s.goBtn}
      data-size={large ? "lg" : undefined}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        open();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseEnter={() => doors.hint(label)}
      onMouseLeave={() => doors.hint(null)}
      onFocus={() => doors.hint(label)}
      onBlur={() => doors.hint(null)}
    >
      {icon}
    </button>
  );
  const size = large ? 16 : 13;
  return (
    <>
      {mark(`Opens ${team.team_name} in the Week desk`, () => doors.week(team, from()), <CalendarDays size={size} />)}
      {mark(`Opens Dime on ${team.team_name}`, () => doors.dime(team, dimeFrom()), <MessagesSquare size={size} />)}
    </>
  );
}

export function Parts({ parts, empty }: { parts: CountPart[]; empty: string }) {
  if (!parts.length) return <span>{empty}</span>;
  return (
    <span>
      {parts.map((p, i) => (
        <span key={p.word}>
          {i ? " · " : ""}
          <span className={p.tone === "down" ? s.downText : p.tone === "warn" ? s.warnText : undefined}>
            <b>{p.n}</b> {p.word}
          </span>
        </span>
      ))}
    </span>
  );
}

function cellValue(c: DuelCell | null, date: string | null, tz: string): string {
  if (!c) return "";
  if (c.mark === "live" || c.mark === "final") return c.points != null ? c.points.toFixed(1) : c.mark;
  if (c.mark === "out") return "OUT";
  if (c.mark === "later" || c.mark === "questionable") return c.tipEt ? tip(c.tipEt, date, { tz }) : "plays";
  return "–";
}

function DuelView({ team, duel, loading, tz }: { team: TeamOverview; duel: Duel; loading: boolean; tz: string }) {
  const points = team.scoring_format !== "categories";
  const opp = duel.opp;
  const d = opp ? duel.you.points - opp.points : 0;
  const playing = benchPlaying(duel.bench.you);
  const first = playing[0];
  const oppPlaying = benchPlaying(duel.bench.opp).length;
  return (
    <>
      <div className={s.dh}>
        <div className={s.dside}>
          <span className={s.dname}>{team.team_name}</span>
          {points ? <span className={s.dbig}>{duel.you.points.toFixed(1)}</span> : null}
        </div>
        {points && opp ? (
          <span className={s.margin} data-tone={Math.abs(d) < 0.05 ? "even" : d > 0 ? "up" : "down"}>
            {signed(d)}
          </span>
        ) : (
          <span />
        )}
        <div className={s.dside} data-mirror="true">
          <span className={s.dname}>{team.matchup?.opponent_name ?? "Opponent"}</span>
          {points ? <span className={s.dbig}>{opp ? opp.points.toFixed(1) : "—"}</span> : null}
        </div>
      </div>
      <div className={`${s.dparts} ${s.m}`}>
        <Parts parts={duel.you.parts} empty="no games tonight" />
        <span>{opp ? <Parts parts={opp.parts} empty="no games tonight" /> : loading ? "reading their lineup…" : "their lineup could not be read"}</span>
      </div>
      {duel.rows.map((r) => (
        <div key={r.key} className={s.du}>
          <span className={s.dn} data-mark={r.you?.mark}>
            {r.you ? shortName(r.you.name) : ""}
          </span>
          <span className={s.dv} data-mark={r.you?.mark}>
            {cellValue(r.you, team.nba_date, tz)}
          </span>
          <span className={s.dsp}>
            <span className={s.slot}>{r.slot}</span>
          </span>
          <span className={s.dv} data-mirror="true" data-mark={r.opp?.mark}>
            {cellValue(r.opp, team.nba_date, tz)}
          </span>
          <span className={s.dn} data-mirror="true" data-mark={r.opp?.mark}>
            {r.opp ? shortName(r.opp.name) : ""}
          </span>
        </div>
      ))}
      <div className={s.dbe}>
        <span>Bench</span>
        <b>{duel.bench.you.length}</b>
        {first ? (
          <span className={s.accentText}>
            · {shortName(first.name).replace(/^.\. /, "")} {first.mark === "live" || first.mark === "final" ? first.mark : `plays ${first.tipEt ? tip(first.tipEt, team.nba_date, { tz }) : "tonight"}`}
            {playing.length > 1 ? `, +${playing.length - 1}` : ""}
          </span>
        ) : duel.bench.you.length ? (
          <span>· none play</span>
        ) : null}
        <span className={s.push}>
          {opp ? (
            <>
              <b>{duel.bench.opp.length}</b> · {oppPlaying} play
            </>
          ) : null}
        </span>
      </div>
    </>
  );
}

function ItemRow({ item, date, now, tz }: { item: OverviewItem; date: string | null; now: number; tz: string }) {
  const deadline = item.deadline_at ? Date.parse(item.deadline_at) : null;
  const until = deadline != null ? untilText(deadline - now) : null;
  return (
    <div className={s.item}>
      <div className={s.itemTop}>
        <span className={s.st} data-state={item.standing}>
          {item.standing === "covered" ? "Covered" : STATE_WORD[item.standing]}
        </span>
        <span className={s.m}>
          {item.standing === "covered" && item.covered_by ? `${COVER_WORD[item.covered_by]} is set to make it` : null}
          {item.standing !== "covered" && deadline != null ? (
            <>
              <b>before {localClock(deadline, { tz })}</b>
              {` · ${until ?? "passed"}`}
            </>
          ) : null}
          {item.standing === "your_call" && deadline == null ? "any time today" : null}
        </span>
      </div>
      <span className={s.itemSay}>{item.action.title}</span>
      {item.action.detail ? <span className={s.itemDet}>{localizeEtClocks(item.action.detail, date, { tz })}</span> : null}
    </div>
  );
}

interface TeamSideProps {
  team: TeamOverview;
  duel: Duel | null;
  duelLoading: boolean;
  last: LastCheckin | undefined;
  now: number;
  tz: string;
  doors: Doors;
  onBack: () => void;
}

/** The picked team's own page: tonight's matchup roster against roster, its automations, and today's moves. */
export function TeamSide({ team, duel, duelLoading, last, now, tz, doors, onBack }: TeamSideProps) {
  const a = team.automation;
  const m = team.matchup;
  const cats = team.scoring_format === "categories";
  const margin = m ? m.your_score - m.opponent_score : 0;
  const levels: Array<[string, AutomationLevel]> = a
    ? [
        ["Lineup", a.lineup],
        ["Late scratches", a.late_scratch],
        ["Lanes", a.lanes],
        ["Daily actions", a.daily_actions],
      ]
    : [];
  const self = () => document.getElementById("home-team-page");
  return (
    <aside id="home-team-page" className={s.side} aria-label={team.team_name} tabIndex={-1}>
      <div className={s.sideHead}>
        <button type="button" className={s.back} onClick={onBack} aria-label="Back to every team">
          <ChevronLeft size={14} /> Home
        </button>
        <b>{team.team_name}</b>
        <span className={dk.sub}>{team.season?.standing ? `${ordinal(team.season.standing)} of ${team.season.teams}` : (team.league_name ?? "")}</span>
        <span className={s.sideDoors}>
          <DoorMarks team={team} doors={doors} from={self} large />
        </span>
      </div>

      {m ? (
        <div className={s.tscore}>
          <div className={s.tbig}>
            {cats
              ? `${m.categories?.wins ?? 0} – ${m.categories?.losses ?? 0}${m.categories?.ties ? ` – ${m.categories.ties}` : ""}`
              : `${pts(m.your_score)} – ${pts(m.opponent_score)}`}
            {!cats ? (
              <span className={s.margin} data-tone={Math.abs(margin) < 0.05 ? "even" : margin > 0 ? "up" : "down"}>
                {signed(margin)}
              </span>
            ) : null}
          </div>
          <div className={s.m} style={{ marginTop: 6 }}>
            {m.win_chance != null ? `${Math.round(m.win_chance * 100)}% · ` : ""}
            {cats ? "categories" : `proj ${Math.round(m.your_projected).toLocaleString("en-US")}–${Math.round(m.opponent_projected).toLocaleString("en-US")}`} · vs {m.opponent_name}
          </div>
        </div>
      ) : null}

      <div className={s.sec}>
        <div className={s.secHead}>
          <span className={dk.label}>Matchup · tonight</span>
          {team.tonight?.next_lock_at && Date.parse(team.tonight.next_lock_at) > now ? (
            <span className={dk.sub}>next lock {localClock(Date.parse(team.tonight.next_lock_at), { tz })}</span>
          ) : null}
        </div>
        {duel ? <DuelView team={team} duel={duel} loading={duelLoading} tz={tz} /> : <span className={s.quiet}>{team.error?.message ?? "Tonight's lineup could not be read."}</span>}
        {levels.length ? (
          <div className={s.chips}>
            {a?.autopilot ? (
              <span className={s.chipOl}>
                <span className={dk.spectrumText}>Autopilot</span>
              </span>
            ) : null}
            {levels
              .filter(([, level]) => level !== "off")
              .map(([name, level]) => (
                <span key={name} className={s.chipOl}>
                  {name} · <span className={level === "notify" ? s.warnText : undefined}>{LEVEL_WORD[level]}</span>
                </span>
              ))}
            {levels.every(([, level]) => level === "off") ? <span className={s.chipOl}>No automation on this team</span> : null}
          </div>
        ) : null}
      </div>

      <div className={s.sec}>
        <div className={s.secHead}>
          <span className={dk.label}>Today</span>
          <span className={dk.sub}>what stands on this team</span>
        </div>
        {team.items.length ? (
          team.items.map((item) => <ItemRow key={item.action.id} item={item} date={team.nba_date} now={now} tz={tz} />)
        ) : (
          <span className={s.quiet}>{team.state === "cant_read" ? "Nothing can be planned until the team reads again." : "Nothing to do."}</span>
        )}
        {last ? (
          <div className={s.item}>
            <div className={s.itemTop}>
              <span className={s.st} data-state="autopilot">
                <span className={dk.spectrumText}>Dime</span>
              </span>
              <span className={s.m}>checked in {localWeekdayTime(Date.parse(last.at), { tz })}</span>
              <button type="button" className={`${s.door} ${s.push}`} onClick={() => doors.dime(team, self(), last.conversationId)}>
                check-in <ChevronRight size={11} />
              </button>
            </div>
            <span className={s.itemDet}>{localizeProseClocks(last.title, team.nba_date, { tz })}</span>
          </div>
        ) : null}
        {team.next ? (
          <div className={s.m} style={{ marginTop: 10 }}>
            next <b>{nextWord(team.next)}</b> {localWeekdayTime(Date.parse(team.next.at), { tz })} · {team.next.label}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
