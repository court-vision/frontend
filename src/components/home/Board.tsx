"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, MessagesSquare } from "lucide-react";
import dk from "@/components/desk/desk.module.css";
import { ACCOUNT } from "@/components/desk/routes";
import { pts, signed } from "@/components/week/format";
import {
  STATE_WORD,
  leadItem,
  moreItems,
  nextWord,
  rowHead,
  seatParts,
  seatsPlaying,
  seatsTotal,
  tapeOf,
  todayOf,
  untilText,
  weekCells,
  type LastCheckin,
  type Tape,
} from "@/lib/home";
import { localClock, localizeEtClocks, localizeProseClocks, localWeekdayTime } from "@/lib/local-time";
import type { TeamOverview, TeamsOverviewData } from "@/types/team-overview";
import { DoorMarks, Parts, ordinal, type Doors } from "./TeamSide";
import s from "./home.module.css";

const HOUR = 3_600_000;

/** A team's row, and the week strip in it: what grows into the desk the row opens. */
export const rowEl = (teamId: number) => document.getElementById(`home-row-${teamId}`);
export const weekEl = (teamId: number) => document.getElementById(`home-week-${teamId}`) ?? rowEl(teamId);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** 1339.4 → "1,339": a projection, which is not known to the decimal. */
const whole = (n: number) => Math.round(n).toLocaleString("en-US");

// ---- what a row says, shared by the row and the phone card

interface RowSay {
  say: string;
  detail: string | null;
  /** "before 5:30 PM" and "in 48 min", or the quiet words for a team that needs nothing. */
  when: React.ReactNode;
  whenText: string;
  /** The team has a move the user could make (the row offers its Week desk). */
  open: boolean;
}

function rowSay(team: TeamOverview, last: LastCheckin | undefined, now: number, tz: string): RowSay {
  const head = rowHead(team);
  const lead = leadItem(team);
  const open = lead != null && lead.standing !== "covered";
  let say = head.say;
  let detail = localizeEtClocks(head.detail, team.nba_date, { tz }) ?? null;
  // A team Dime drives with nothing open leads with Dime's own last word on it
  if (team.state === "autopilot" && !lead && last) {
    detail = say.replace(/^Dime is driving\. /, "");
    say = localizeProseClocks(last.title, team.nba_date, { tz });
  }
  if (team.state === "cant_read") return { say, detail, when: null, whenText: "", open: false };
  if (open) {
    const until = head.deadlineAt != null ? untilText(head.deadlineAt - now) : null;
    if (head.deadlineAt != null && until) {
      const before = `before ${localClock(head.deadlineAt, { tz })}`;
      return {
        say,
        detail,
        open,
        whenText: before,
        when: (
          <>
            <b className={s.t1}>{before}</b>
            <span>{until}</span>
          </>
        ),
      };
    }
    return { say, detail, open, whenText: "any time today", when: <span>any time today</span> };
  }
  const quiet = team.state === "autopilot" ? "Dime is driving" : lead ? "covered for you" : "nothing to do";
  return { say, detail, open, whenText: quiet, when: <span>{quiet}</span> };
}

/** "5:10 PM" for a check-in in the last day, "Wed 5:10 PM" for an older one. */
function checkinWhen(last: LastCheckin, now: number, tz: string): string {
  const at = Date.parse(last.at);
  return now - at < 20 * HOUR ? localClock(at, { tz }) : localWeekdayTime(at, { tz });
}

function StateChip({ team }: { team: TeamOverview }) {
  return (
    <span className={s.st} data-state={team.state}>
      {team.state === "autopilot" ? <span className={dk.spectrumText}>{STATE_WORD.autopilot}</span> : STATE_WORD[team.state]}
    </span>
  );
}

function Score({ team }: { team: TeamOverview }) {
  const m = team.matchup;
  if (!m) return <span className={s.t3}>no matchup</span>;
  const live = (team.tonight?.counts.live ?? 0) > 0;
  if (team.scoring_format === "categories") {
    return (
      <span className={s.score}>
        {live ? <span className={dk.liveDot} /> : null}
        {m.categories?.wins ?? 0} <span className={s.t3}>–</span> {m.categories?.losses ?? 0}
        {m.categories?.ties ? (
          <>
            {" "}
            <span className={s.t3}>–</span> {m.categories.ties}
          </>
        ) : null}
      </span>
    );
  }
  return (
    <span className={s.score}>
      {live ? <span className={dk.liveDot} /> : null}
      {pts(m.your_score)} <span className={s.t3}>–</span> {pts(m.opponent_score)}
    </span>
  );
}

function WinBar({ chance, width = 84 }: { chance: number; width?: number }) {
  return (
    <span className={s.wb} style={{ width }} data-losing={chance < 0.5}>
      <i style={{ width: `${Math.round(chance * 100)}%` }} />
    </span>
  );
}

// ---- the strip above the rows

function verdictOf(t: Tape): { n: number | null; tone: string | undefined; text: string } {
  if (t.needs) return { n: t.needs, tone: s.downText, text: t.needs === 1 ? "thing needs you" : "things need you" };
  if (t.calls) return { n: t.calls, tone: s.accentText, text: t.calls === 1 ? "idea to take or leave" : "ideas to take or leave" };
  return { n: null, tone: undefined, text: "Nothing needs you" };
}

function Tile({ label, value, small, sub, verdict = false }: { label: string; value: React.ReactNode; small?: string | null; sub: string; verdict?: boolean }) {
  return (
    <div className={s.tile}>
      <span className={dk.label}>{label}</span>
      <span className={verdict ? `${s.tileV} ${s.verdict}` : s.tileV}>
        {value}
        {small ? <small>{small}</small> : null}
      </span>
      <span className={s.tileS}>{sub}</span>
    </div>
  );
}

function TapeStrip({ data, tape, now, tz }: { data: TeamsOverviewData; tape: Tape; now: number; tz: string }) {
  const v = verdictOf(tape);
  const under: string[] = [];
  if (tape.needs && tape.calls) under.push(`${plural(tape.calls, "idea", "ideas")} to take or leave`);
  if (tape.quiet) under.push(`${plural(tape.quiet, "team needs", "teams need")} nothing`);
  if (tape.cantRead) under.push(`${plural(tape.cantRead, "team", "teams")} can't be read`);
  const deadline = tape.needs && tape.deadlineAt != null && tape.deadlineAt > now ? `before ${localClock(tape.deadlineAt, { tz })}` : null;

  const tonight: string[] = [];
  if (tape.seats.live) tonight.push(`${tape.seats.live} live`);
  if (tape.seats.toCome) tonight.push(`${tape.seats.toCome} to come`);
  if (tape.seats.final) tonight.push(`${tape.seats.final} final`);

  const matchups = data.teams.filter((t) => t.matchup);
  const favored = matchups.filter((t) => (t.matchup!.win_chance != null ? t.matchup!.win_chance > 0.5 : t.matchup!.your_projected > t.matchup!.opponent_projected)).length;

  return (
    <div className={s.tape}>
      <Tile
        verdict
        label="Right now"
        value={
          v.n != null ? (
            <>
              <span className={v.tone}>{v.n}</span> {v.text}
            </>
          ) : (
            v.text
          )
        }
        small={deadline}
        sub={under.join(" · ") || "No teams yet"}
      />
      <Tile
        label="Next lock"
        value={tape.nextLockAt != null ? localClock(tape.nextLockAt, { tz }) : "—"}
        small={tape.nextLockAt != null ? untilText(tape.nextLockAt - now) : null}
        sub={
          tape.nextLockAt != null
            ? tape.lockSeats
              ? `${tape.lockSeats} of your starters ${tape.lockSeats === 1 ? "tips" : "tip"} then`
              : "none of your starters tip then"
            : tape.seats.playing
              ? "every game of yours has tipped"
              : "no games tonight"
        }
      />
      <Tile label="Tonight" value={`${tape.seats.playing} of ${tape.seats.total}`} small="starters" sub={tonight.join(" · ") || "no games tonight"} />
      <Tile
        label="Matchups"
        value={matchups.length ? `${tape.ahead} ahead` : "—"}
        small={matchups.length ? `${tape.behind} behind${tape.level ? ` · ${tape.level} level` : ""}` : null}
        sub={matchups.length ? `${favored} of ${matchups.length} projected to win` : "no matchups this week"}
      />
      <Tile
        label="Season"
        value={tape.leagues ? `${tape.wins}–${tape.losses}${tape.ties ? `–${tape.ties}` : ""}` : "—"}
        small={tape.leagues ? `across ${plural(tape.leagues, "league", "leagues")}` : null}
        sub={tape.leagues ? (tape.firsts ? `${plural(tape.firsts, "team", "teams")} in first place` : "no team in first place") : "standings are being read"}
      />
    </div>
  );
}

// ---- a team's row

interface RowProps {
  team: TeamOverview;
  demo: boolean;
  picked: boolean;
  last: LastCheckin | undefined;
  now: number;
  tz: string;
  doors: Doors;
  onPick: (team: TeamOverview, open: boolean) => void;
}

function seasonLines(team: TeamOverview): [string, string] {
  const se = team.season;
  if (!se) return [team.season_state === "pending" ? "reading the standings…" : "", ""];
  const record = `${se.wins}–${se.losses}${se.ties ? `–${se.ties}` : ""}`;
  const place = se.standing ? ` · ${ordinal(se.standing)} of ${se.teams}` : "";
  const odds =
    se.playoff_odds != null
      ? se.playoff_odds >= 0.995
        ? "all but in the playoffs"
        : `${Math.round(se.playoff_odds * 100)}% to make the playoffs`
      : team.season_state === "pending"
        ? "projecting the season…"
        : "";
  return [`${record}${place}`, odds];
}

function TeamRow({ team, demo, picked, last, now, tz, doors, onPick }: RowProps) {
  const row = rowSay(team, last, now, tz);
  const more = moreItems(team);
  const [record, odds] = seasonLines(team);
  const m = team.matchup;
  const cats = team.scoring_format === "categories";
  const tonight = team.tonight;
  const today = todayOf(team.week);
  const cells = weekCells(team.week);
  const lock = tonight?.next_lock_at ? Date.parse(tonight.next_lock_at) : null;
  const margin = m ? m.your_score - m.opponent_score : 0;
  const strip = () => weekEl(team.team_id);

  return (
    <div
      id={`home-row-${team.team_id}`}
      className={s.row}
      data-state={team.state}
      data-picked={picked}
      tabIndex={0}
      aria-current={picked ? "true" : undefined}
      aria-label={`${team.team_name}: ${STATE_WORD[team.state]}. ${row.say}`}
      onClick={() => onPick(team, true)}
      onFocus={(e) => {
        if (e.target === e.currentTarget && !picked) onPick(team, false);
      }}
      onDoubleClick={() => doors.week(team, strip())}
    >
      <div className={s.col}>
        <div className={s.ln}>
          <span className={s.name}>{team.team_name}</span>
        </div>
        <div className={`${s.ln} ${s.m}`}>
          <span className={s.el}>{team.league_name ?? (team.provider === "yahoo" ? "Yahoo" : "ESPN")}</span>
        </div>
        <div className={`${s.ln} ${s.m}`}>
          <b>{record}</b>
        </div>
        <div className={`${s.ln} ${s.m}`}>
          <span className={s.el}>{odds}</span>
        </div>
      </div>

      <div className={s.col}>
        <div className={`${s.ln} ${s.m}`}>
          <StateChip team={team} />
          {row.when}
          {more ? <span className={`${s.more} ${s.push}`}>+{more} more</span> : null}
          {last ? (
            <button
              type="button"
              className={`${s.door} ${more ? "" : s.push}`}
              onClick={(e) => {
                e.stopPropagation();
                doors.dime(team, rowEl(team.team_id), last.conversationId);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              onMouseEnter={() => doors.hint(`Opens Dime's ${checkinWhen(last, now, tz)} check-in on ${team.team_name}`)}
              onMouseLeave={() => doors.hint(null)}
            >
              {checkinWhen(last, now, tz)} check-in <ChevronRight size={11} />
            </button>
          ) : null}
        </div>
        <div className={s.ln}>
          <span className={s.say}>{row.say}</span>
        </div>
        <div className={s.ln}>
          <span className={s.det}>{row.detail}</span>
        </div>
        <div className={`${s.ln} ${s.m}`}>
          {row.open ? (
            <button
              type="button"
              className={s.door}
              onClick={(e) => {
                e.stopPropagation();
                doors.week(team, strip());
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              onMouseEnter={() => doors.hint(`Opens ${team.team_name} in the Week desk, where the move is made`)}
              onMouseLeave={() => doors.hint(null)}
            >
              Review in Week <ChevronRight size={11} />
            </button>
          ) : null}
          {team.state === "cant_read" && !demo ? (
            <Link
              href={`${ACCOUNT.href}?t=${team.team_id}`}
              className={s.door}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => doors.hint(`Opens ${team.team_name} in Account, where its connection is`)}
              onMouseLeave={() => doors.hint(null)}
            >
              Open in Account <ChevronRight size={11} />
            </Link>
          ) : null}
          {team.next ? (
            <span className={s.el}>
              next <b>{nextWord(team.next)}</b> {localWeekdayTime(Date.parse(team.next.at), { tz })}
              {team.next.kind === "pickup" || team.next.kind === "lane" ? ` · ${team.next.label}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      <div className={`${s.col} ${s.colTonight}`}>
        {tonight ? (
          <>
            <div className={s.ln}>
              <span className={s.dots}>
                {tonight.seats.map((seat, i) => (
                  <i key={i} data-mark={seat.mark} />
                ))}
              </span>
            </div>
            <div className={`${s.ln} ${s.m}`}>
              <span className={s.el}>
                <Parts parts={seatParts(tonight.counts)} empty="no games tonight" />
              </span>
            </div>
            <div className={`${s.ln} ${s.m}`}>
              {cats || !today || today.your_points == null || today.opponent_points == null ? (
                <span>
                  <b>{seatsPlaying(tonight.counts)}</b> of {seatsTotal(tonight.counts)} seats play
                </span>
              ) : (
                <span>
                  today{" "}
                  <b>
                    {today.your_points.toFixed(1)} – {today.opponent_points.toFixed(1)}
                  </b>{" "}
                  <span className={today.your_points >= today.opponent_points ? s.upText : s.downText}>{signed(today.your_points - today.opponent_points)}</span>
                </span>
              )}
            </div>
            <div className={`${s.ln} ${s.m}`}>
              <span className={s.el}>
                {lock != null && lock > now ? (
                  <>
                    next lock <b>{localClock(lock, { tz })}</b>
                  </>
                ) : seatsPlaying(tonight.counts) ? (
                  "every game has tipped"
                ) : (
                  ""
                )}
              </span>
            </div>
          </>
        ) : (
          <div className={`${s.ln} ${s.m}`}>
            <span className={s.el}>tonight could not be read</span>
          </div>
        )}
      </div>

      <div className={s.col}>
        <div className={s.ln}>
          <Score team={team} />
          {m && !cats ? (
            <span className={s.margin} data-tone={Math.abs(margin) < 0.05 ? "even" : margin > 0 ? "up" : "down"}>
              {signed(margin)}
            </span>
          ) : m ? (
            <span className={`${s.m} ${s.t3}`}>categories</span>
          ) : null}
        </div>
        <div className={`${s.ln} ${s.m}`}>
          {m?.win_chance != null ? <WinBar chance={m.win_chance} width={60} /> : null}
          {m ? (
            <span className={s.el}>
              {m.win_chance != null ? (
                <>
                  <b>{Math.round(m.win_chance * 100)}%</b>
                  {cats ? " to win the week" : " · "}
                </>
              ) : null}
              {cats ? null : `proj ${whole(m.your_projected)}–${whole(m.opponent_projected)}`}
            </span>
          ) : null}
        </div>
        <div className={s.ln}>
          <span id={`home-week-${team.team_id}`} className={s.wk}>
            {cells.map((c) => (
              <i key={c.date} data-tone={c.tone ?? undefined} data-kind={c.kind} title={c.title}>
                {c.text}
              </i>
            ))}
          </span>
        </div>
        <div className={`${s.ln} ${s.m} ${s.vs}`}>
          <span className={s.el}>{m ? `vs ${m.opponent_name}` : ""}</span>
        </div>
      </div>

      <span className={s.go}>
        <DoorMarks team={team} doors={doors} from={strip} dimeFrom={() => rowEl(team.team_id)} />
      </span>
    </div>
  );
}

// ---- a team's card on a phone: slide it right for its Week desk, left for Dime

const SLIDE_OPEN = 76;
const SLIDE_MAX = 112;

function TeamCard({ team, last, now, tz, doors, onPick }: Omit<RowProps, "picked" | "demo">) {
  const row = rowSay(team, last, now, tz);
  const m = team.matchup;
  const cats = team.scoring_format === "categories";
  const card = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; id: number; sliding: boolean } | null>(null);
  const slid = useRef(false);
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);

  const end = (commit: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.sliding) return;
    slid.current = true;
    setSettling(true);
    const reach = dx;
    setDx(0);
    if (!commit) return;
    if (reach >= SLIDE_OPEN) doors.week(team, card.current);
    else if (reach <= -SLIDE_OPEN) doors.dime(team, card.current, null);
  };

  return (
    <div className={s.slide}>
      <span className={s.under} data-side="week" aria-hidden style={{ opacity: dx > 0 ? 1 : 0 }}>
        <CalendarDays size={16} /> Week
      </span>
      <span className={s.under} data-side="dime" aria-hidden style={{ opacity: dx < 0 ? 1 : 0 }}>
        Dime <MessagesSquare size={16} />
      </span>
      <button
        ref={card}
        type="button"
        className={s.card}
        data-state={team.state}
        data-settling={settling}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        aria-label={`${team.team_name}: ${STATE_WORD[team.state]}. ${row.say} Opens the team. Slide right for its Week desk, left for Dime.`}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, sliding: false };
          slid.current = false;
          setSettling(false);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const mx = e.clientX - d.x;
          const my = e.clientY - d.y;
          if (!d.sliding) {
            if (Math.abs(mx) < 10 || Math.abs(mx) < Math.abs(my) * 1.2) return;
            d.sliding = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          setDx(Math.max(-SLIDE_MAX, Math.min(SLIDE_MAX, mx)));
        }}
        onPointerUp={() => end(true)}
        onPointerCancel={() => end(false)}
        onTransitionEnd={() => setSettling(false)}
        onClick={(e) => {
          // The click that ends a slide is the slide's, not a tap
          if (slid.current) {
            slid.current = false;
            e.preventDefault();
            return;
          }
          onPick(team, true);
        }}
      >
        <div className={s.r1}>
          <span className={s.name}>{team.team_name}</span>
          <Score team={team} />
        </div>
        <div className={s.r2}>
          <StateChip team={team} />
          <span className={s.el}>{row.whenText}</span>
          {m?.win_chance != null ? (
            <span className={s.push} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <WinBar chance={m.win_chance} width={50} />
              <span>{Math.round(m.win_chance * 100)}%</span>
            </span>
          ) : cats ? (
            <span className={s.push}>categories</span>
          ) : null}
        </div>
        <div className={s.r3}>{row.say}</div>
      </button>
    </div>
  );
}

// ---- the board

interface BoardProps {
  data: TeamsOverviewData;
  /** The picked team's id. */
  picked: number | null;
  lasts: Map<number, LastCheckin>;
  now: number;
  tz: string;
  demo: boolean;
  doors: Doors;
  /** `open`: the pick came from a click or tap, which also opens the team's page where the page takes the screen. */
  onPick: (team: TeamOverview, open: boolean) => void;
}

/** The strip of what stands across the teams. Outside the body, above the rows and the picked team's page. */
export function HomeTape({ data, now, tz }: { data: TeamsOverviewData; now: number; tz: string }) {
  return <TapeStrip data={data} tape={tapeOf(data, now)} now={now} tz={tz} />;
}

export function Board({ data, picked, lasts, now, tz, demo, doors, onPick }: BoardProps) {
  const tape = tapeOf(data, now);
  const v = verdictOf(tape);
  const line: string[] = [];
  if (tape.ahead || tape.behind) line.push(`${tape.ahead} ahead`, `${tape.behind} behind`);
  if (tape.nextLockAt != null) line.push(`next lock ${localClock(tape.nextLockAt, { tz })}`);
  const addHref = demo ? `${ACCOUNT.href}?demo` : `${ACCOUNT.href}?add`;
  return (
    <section className={s.board} aria-label="Your teams">
      <div className={s.head}>
        <span className={dk.label}>Team</span>
        <span className={dk.label}>Status</span>
        <span className={`${dk.label} ${s.headTonight}`}>Tonight</span>
        <span className={dk.label}>This week</span>
      </div>
      {data.teams.map((team) => (
        <TeamRow key={team.team_id} team={team} demo={demo} picked={team.team_id === picked} last={lasts.get(team.team_id)} now={now} tz={tz} doors={doors} onPick={onPick} />
      ))}
      <div className={s.addRow}>
        <Link href={addHref}>
          <span className={dk.mono}>+</span> Add a team
        </Link>
        <span className={s.legend}>
          <span className={s.dots}>
            <i data-mark="live" />
          </span>
          live
          <span className={s.dots}>
            <i data-mark="later" />
          </span>
          to come
          <span className={s.dots}>
            <i data-mark="questionable" />
          </span>
          questionable
          <span className={s.dots}>
            <i data-mark="out" />
          </span>
          out
          <span className={s.dots}>
            <i data-mark="idle" />
          </span>
          no game
          <span style={{ marginLeft: 10 }}>week: each day&apos;s margin, then your games v theirs</span>
        </span>
      </div>

      <div className={s.cards}>
        <div className={s.verdictCard}>
          <span className={dk.label}>Right now · {localWeekdayTime(now, { tz })}</span>
          <h1>{v.n != null ? <><span className={v.tone}>{v.n}</span> {v.text}</> : v.text}</h1>
          {line.length ? (
            <div className={s.m} style={{ marginTop: 7 }}>
              {line.join(" · ")}
            </div>
          ) : null}
        </div>
        {data.teams.map((team) => (
          <TeamCard key={team.team_id} team={team} last={lasts.get(team.team_id)} now={now} tz={tz} doors={doors} onPick={onPick} />
        ))}
        <div className={s.quiet} style={{ padding: "12px 16px" }}>
          Tap a team for its page. Slide it right for its Week desk, left for Dime.
        </div>
      </div>
    </section>
  );
}
