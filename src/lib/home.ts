/**
 * The Home desk's reading of the teams overview (`GET /teams/overview`): what a team's row says,
 * the strip above the rows, tonight's matchup seat against seat, and when to read again. The
 * server decides each team's state and writes each move's copy; this file only arranges them.
 * Pure: no React, no fetching, and the clock is always passed in.
 */
import { gameState, type GameState } from "@/lib/scout";
import type { AiCheckin } from "@/types/ai";
import type { GamesOnDateData } from "@/types/games";
import type { LiveMatchupData, LiveMatchupPlayer } from "@/types/matchup";
import type {
  CoveredBy,
  OverviewDay,
  OverviewItem,
  OverviewNext,
  OverviewSeat,
  SeatMark,
  TeamOverview,
  TeamState,
  TeamsOverviewData,
} from "@/types/team-overview";

const MINUTE = 60_000;

export const STATE_WORD: Record<TeamState, string> = {
  needs_you: "Needs you",
  your_call: "Your call",
  set: "Set",
  autopilot: "Autopilot",
  cant_read: "Can't read",
};

/** The automation set to make a move, as the row names it. */
export const COVER_WORD: Record<CoveredBy, string> = {
  auto_lineup: "Auto-lineup",
  late_scratch: "The late-scratch swap",
  daily_actions: "Daily actions",
  dime: "Dime",
};

const NEXT_WORD: Record<OverviewNext["kind"], string> = {
  auto_lineup: "auto-lineup",
  pickup: "pickup",
  lane: "lane switch",
  checkin: "check-in",
};

/** "in 48 min", "in 2 h 5 min", "now" once it is under a minute away, null once it has passed. */
export function untilText(ms: number): string | null {
  if (ms < 0) return null;
  const min = Math.floor(ms / MINUTE);
  if (min < 1) return "now";
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

/** The item a row leads with: the first that needs the user, else the first that is their call, else the first covered. */
export function leadItem(team: TeamOverview): OverviewItem | null {
  const by = (standing: OverviewItem["standing"]) => team.items.find((i) => i.standing === standing) ?? null;
  return by("needs_you") ?? by("your_call") ?? by("covered");
}

/** Items the user could act on, beyond the one the row shows. */
export function moreItems(team: TeamOverview): number {
  const open = team.items.filter((i) => i.standing !== "covered").length;
  return Math.max(0, open - (leadItem(team)?.standing === "covered" ? 0 : 1));
}

/** How many of the starting seats have a game today (on, over or still to come). */
export function seatsPlaying(counts: Record<string, number> | null | undefined): number {
  if (!counts) return 0;
  return (counts.live ?? 0) + (counts.final ?? 0) + (counts.later ?? 0) + (counts.questionable ?? 0);
}

export function seatsTotal(counts: Record<string, number> | null | undefined): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((a, n) => a + n, 0);
}

export interface CountPart {
  n: number;
  word: string;
  tone?: "down" | "warn";
}

/** Tonight's starting seats in words: 3 live · 2 final · 4 to come · 1 Q · 1 out. Empty when nobody plays. */
export function seatParts(counts: Record<string, number> | null | undefined): CountPart[] {
  if (!counts) return [];
  const parts: CountPart[] = [];
  const add = (n: number | undefined, word: string, tone?: CountPart["tone"]) => {
    if (n) parts.push({ n, word, tone });
  };
  add(counts.live, "live");
  add(counts.final, "final");
  add(counts.later, "to come");
  add(counts.questionable, "Q", "warn");
  add(counts.out, "out", "down");
  add(counts.empty, "empty", "down");
  return parts;
}

/** What the row says under its state. `say` is the sentence; `detail` the line under it. */
export interface RowHead {
  say: string;
  detail: string | null;
  /** The deadline of the move the row leads with, when it has one. */
  deadlineAt: number | null;
  /** The automation set to make the lead move (a covered item). */
  coveredBy: CoveredBy | null;
}

export function rowHead(team: TeamOverview): RowHead {
  const none: RowHead = { say: "", detail: null, deadlineAt: null, coveredBy: null };
  if (team.state === "cant_read") {
    return { ...none, say: team.error?.message ?? "This team's board could not be read.", detail: cantReadHint(team.error?.code) };
  }
  const lead = leadItem(team);
  if (lead) {
    const deadlineAt = lead.deadline_at ? Date.parse(lead.deadline_at) : null;
    if (lead.standing === "covered" && lead.covered_by) {
      return { say: lead.action.title, detail: `${COVER_WORD[lead.covered_by]} is set to make this move.`, deadlineAt, coveredBy: lead.covered_by };
    }
    return { say: lead.action.title, detail: lead.action.detail ?? null, deadlineAt, coveredBy: null };
  }
  const counts = team.tonight?.counts;
  const total = seatsTotal(counts);
  const playing = seatsPlaying(counts);
  const lineup = !team.tonight ? "Nothing to do." : playing === 0 ? "No games tonight." : `Lineup is set. ${playing} of ${total} starters play tonight.`;
  return { ...none, say: team.state === "autopilot" ? `Dime is driving. ${lineup}` : lineup };
}

function cantReadHint(code: string | null | undefined): string | null {
  if (code === "PROVIDER_AUTH_EXPIRED") return "Its account's sign-in has expired: reconnect it in Account.";
  if (code === "PROVIDER_TIMEOUT") return "The provider did not answer in time. It is read again on the next refresh.";
  if (code === "LINEUP_NOT_SUPPORTED") return "This provider's teams can't be read here yet.";
  return null;
}

/** "auto-lineup", "check-in": the next thing scheduled on the team. */
export function nextWord(next: OverviewNext): string {
  return NEXT_WORD[next.kind];
}

// ---- the week

export interface WeekCell {
  date: string;
  kind: OverviewDay["kind"];
  /** A points margin for a day played ("+12", "−34"), else the games each side has ("5v8"). */
  text: string;
  tone: "up" | "down" | "hi" | "lo" | null;
  title: string;
}

const round = (n: number) => Math.round(n);

/** The matchup's days as the row's strip: a day played shows its margin, a day ahead the games each side has. */
export function weekCells(week: readonly OverviewDay[] | null | undefined): WeekCell[] {
  return (week ?? []).map((d) => {
    const games = `${d.your_games}v${d.opponent_games}`;
    const scored = d.kind !== "future" && d.your_points != null && d.opponent_points != null;
    if (scored) {
      const m = round(d.your_points! - d.opponent_points!);
      return {
        date: d.date,
        kind: d.kind,
        text: m === 0 ? "0" : `${m > 0 ? "+" : "−"}${Math.abs(m)}`,
        tone: m > 0 ? "up" : m < 0 ? "down" : null,
        title: `${d.your_points!.toFixed(1)} – ${d.opponent_points!.toFixed(1)}${d.estimated ? " (counted on today's roster)" : ""}`,
      };
    }
    const diff = d.your_games - d.opponent_games;
    return {
      date: d.date,
      kind: d.kind,
      text: games,
      tone: d.kind === "past" ? null : diff >= 1 ? "hi" : diff <= -2 ? "lo" : null,
      title: `${d.your_games} of yours play, ${d.opponent_games} of theirs`,
    };
  });
}

/** Today's row of the week, for "today 41.5 – 38.0". */
export function todayOf(week: readonly OverviewDay[] | null | undefined): OverviewDay | null {
  return (week ?? []).find((d) => d.kind === "today") ?? null;
}

/**
 * Starters are still to tip and the read holds no lock ahead for them: its next lock has passed and
 * they tip at another time, or their game has no tip time yet (a seat like that sets no lock at
 * all). Until the next read the lock is not known, and "every game has tipped" would be wrong.
 */
export function tipsAfterLock(tonight: TeamOverview["tonight"], now: number): boolean {
  if (!tonight) return false;
  const lock = tonight.next_lock_at ? Date.parse(tonight.next_lock_at) : null;
  if (lock != null && lock > now) return false;
  const toCome = tonight.seats.filter((s) => s.mark === "later" || s.mark === "questionable");
  // With no lock in the read, a starter still to come can only be one whose tip time is not set
  if (lock == null) return toCome.length > 0;
  return toCome.some((s) => s.game_time_et !== tonight.next_lock_et);
}

// ---- the strip above the rows

export interface Tape {
  needs: number;
  calls: number;
  quiet: number;
  cantRead: number;
  /** The soonest deadline among what needs the user. */
  deadlineAt: number | null;
  /** The next tip that locks one of any team's players. */
  nextLockAt: number | null;
  /** Starters that tip at that lock, across the teams. */
  lockSeats: number;
  /** A team's lock has passed since the read, and starters of its still tip later: the next lock is not known yet. */
  lockPending: boolean;
  seats: { total: number; playing: number; live: number; toCome: number; final: number };
  ahead: number;
  behind: number;
  level: number;
  wins: number;
  losses: number;
  ties: number;
  firsts: number;
  leagues: number;
}

export function tapeOf(data: TeamsOverviewData, now: number): Tape {
  const t: Tape = {
    needs: 0, calls: 0, quiet: 0, cantRead: 0, deadlineAt: data.next_deadline_at ? Date.parse(data.next_deadline_at) : null,
    nextLockAt: null, lockSeats: 0, lockPending: false, seats: { total: 0, playing: 0, live: 0, toCome: 0, final: 0 },
    ahead: 0, behind: 0, level: 0, wins: 0, losses: 0, ties: 0, firsts: 0, leagues: 0,
  };
  for (const team of data.teams) {
    t.needs += team.items.filter((i) => i.standing === "needs_you").length;
    t.calls += team.items.filter((i) => i.standing === "your_call").length;
    if (team.state === "cant_read") t.cantRead += 1;
    else if (team.state === "set" || team.state === "autopilot") t.quiet += 1;
    const c = team.tonight?.counts;
    if (c) {
      t.seats.total += seatsTotal(c);
      t.seats.playing += seatsPlaying(c);
      t.seats.live += c.live ?? 0;
      t.seats.final += c.final ?? 0;
      t.seats.toCome += (c.later ?? 0) + (c.questionable ?? 0);
    }
    const lock = team.tonight?.next_lock_at ? Date.parse(team.tonight.next_lock_at) : null;
    if (lock != null && lock > now && (t.nextLockAt == null || lock < t.nextLockAt)) t.nextLockAt = lock;
    if (tipsAfterLock(team.tonight, now)) t.lockPending = true;
    if (team.matchup) {
      const d = team.matchup.your_score - team.matchup.opponent_score;
      if (d > 0) t.ahead += 1;
      else if (d < 0) t.behind += 1;
      else t.level += 1;
    }
    if (team.season) {
      t.leagues += 1;
      t.wins += team.season.wins;
      t.losses += team.season.losses;
      t.ties += team.season.ties;
      if (team.season.standing === 1) t.firsts += 1;
    }
  }
  if (t.nextLockAt != null) {
    for (const team of data.teams) {
      const lockEt = team.tonight?.next_lock_at && Date.parse(team.tonight.next_lock_at) === t.nextLockAt ? team.tonight.next_lock_et : null;
      if (lockEt) t.lockSeats += team.tonight!.seats.filter((s) => s.game_time_et === lockEt && (s.mark === "later" || s.mark === "questionable")).length;
    }
  }
  return t;
}

// ---- when to read again

/**
 * The overview costs three provider reads per team, so it is read at speed only around what it
 * is for: every 90 seconds while any starter's game is on, a lock is within the hour or a
 * deadline is, and every 5 minutes otherwise. A league still being projected is asked for again
 * after 30 seconds (the server keeps an answer for 20). Coming back to the tab reads it again.
 */
export function overviewPollMs(data: TeamsOverviewData | null | undefined, now: number): number {
  if (!data) return 5 * MINUTE;
  if (data.teams.some((t) => t.season_state === "pending")) return 30_000;
  const within = (iso: string | null | undefined, ahead: number) => {
    if (!iso) return false;
    const d = Date.parse(iso) - now;
    return d > -5 * MINUTE && d < ahead;
  };
  const busy =
    within(data.next_deadline_at, 60 * MINUTE) ||
    data.teams.some((t) => (t.tonight?.counts.live ?? 0) > 0 || within(t.tonight?.next_lock_at, 60 * MINUTE));
  return busy ? 90_000 : 5 * MINUTE;
}

// ---- tonight's matchup, seat against seat

export interface DuelCell {
  name: string;
  mark: SeatMark;
  /** Tonight's fantasy points, once his game is on (points leagues). */
  points: number | null;
  /** His tip, ET ("19:30"), while it is still to come. */
  tipEt: string | null;
}

export interface DuelRow {
  key: string;
  slot: string;
  you: DuelCell | null;
  opp: DuelCell | null;
}

export interface DuelSideSum {
  points: number;
  parts: CountPart[];
}

export interface Duel {
  rows: DuelRow[];
  you: DuelSideSum;
  opp: DuelSideSum | null;
  bench: { you: DuelCell[]; opp: DuelCell[] };
}

const BENCH = new Set(["BE", "BN", "BENCH"]);
const IR = new Set(["IR", "IL", "IR+", "IL+"]);

export interface Tip {
  /** Tonight's tip, ET. */
  tipEt: string | null;
  state: GameState;
}

/** NBA team → tonight's tip (ET) and where its game stands, from the day's slate. */
export function tipsOf(slate: GamesOnDateData | null | undefined): Map<string, Tip> {
  const tips = new Map<string, Tip>();
  for (const g of slate?.games ?? []) {
    const tip: Tip = { tipEt: g.start_time_et ?? null, state: gameState(g.status) };
    tips.set(g.home_team, tip);
    tips.set(g.away_team, tip);
  }
  return tips;
}

function youCell(seat: OverviewSeat): DuelCell | null {
  if (seat.player_id == null) return { name: "Empty", mark: "empty", points: null, tipEt: null };
  return { name: seat.name ?? "—", mark: seat.mark, points: seat.points ?? null, tipEt: seat.game_time_et ?? null };
}

/** `line`: his box-score line for this NBA date, null when he has none (or the read is another day's). */
function oppCell(p: LiveMatchupPlayer, line: LiveMatchupPlayer["live"], tips: Map<string, Tip>): DuelCell {
  const out = /^(out|o)$/i.test(p.injury_status ?? "") || (p.injured && /out/i.test(p.injury_status ?? ""));
  const status = line?.game_status ?? 0;
  if (line && status >= 2) return { name: p.name, mark: status >= 3 ? "final" : "live", points: line.live_fpts, tipEt: null };
  const tip = tips.get(p.team);
  if (!tip) return { name: p.name, mark: "idle", points: null, tipEt: null };
  if (out) return { name: p.name, mark: "out", points: null, tipEt: null };
  // No line of his own in a game that is on or over (he has not played in it): not one still to come
  if (tip.state !== "scheduled") return { name: p.name, mark: tip.state, points: null, tipEt: null };
  return { name: p.name, mark: "later", points: null, tipEt: tip.tipEt };
}

function sumSide(cells: Array<DuelCell | null>): DuelSideSum {
  const counts: Record<string, number> = {};
  let points = 0;
  for (const c of cells) {
    if (!c) continue;
    counts[c.mark] = (counts[c.mark] ?? 0) + 1;
    points += c.points ?? 0;
  }
  return { points, parts: seatParts(counts) };
}

/**
 * Tonight's two lineups as the Week desk's matchup view pairs them: your starting seats in the
 * board's order, each against the opponent's player in the same slot (the first not yet paired).
 * Without the opponent's roster (`live` not read yet) the rows carry your side alone.
 */
export function duelOf(team: TeamOverview, live: LiveMatchupData | null | undefined, slate: GamesOnDateData | null | undefined): Duel | null {
  const tonight = team.tonight;
  if (!tonight) return null;
  const tips = tipsOf(slate);
  // The read's box scores are one NBA date's (`game_date`): from the 3 AM ET rollover until the
  // post-game run that is still last night. The roster holds; last night's lines are not tonight's
  const linesToday = !live?.game_date || live.game_date === team.nba_date;
  const cell = (p: LiveMatchupPlayer) => oppCell(p, linesToday ? p.live : null, tips);
  const theirs = live ? [...live.opponent_team.roster] : [];
  const used = new Set<number>();
  const take = (slot: string): LiveMatchupPlayer | null => {
    const i = theirs.findIndex((p, k) => !used.has(k) && p.lineup_slot === slot);
    if (i < 0) return null;
    used.add(i);
    return theirs[i];
  };
  const rows: DuelRow[] = tonight.seats.map((seat, i) => {
    const o = take(seat.slot);
    return { key: `${seat.slot_id}-${i}`, slot: seat.slot, you: youCell(seat), opp: o ? cell(o) : null };
  });
  // Starters of theirs in a slot yours has no seat left for: still counted, still shown
  theirs.forEach((p, k) => {
    if (used.has(k) || BENCH.has(p.lineup_slot.toUpperCase()) || IR.has(p.lineup_slot.toUpperCase())) return;
    used.add(k);
    rows.push({ key: `opp-${p.player_id}`, slot: p.lineup_slot, you: null, opp: cell(p) });
  });
  const you = sumSide(rows.map((r) => r.you));
  if (tonight.points != null) you.points = tonight.points;
  const benchOpp = theirs.filter((p) => BENCH.has(p.lineup_slot.toUpperCase())).map(cell);
  const benchYou = tonight.bench.map(youCell).filter((c): c is DuelCell => c != null && c.mark !== "empty");
  return { rows, you, opp: live ? sumSide(rows.map((r) => r.opp)) : null, bench: { you: benchYou, opp: benchOpp } };
}

/** Bench players with a game today that is on or still to come. */
export function benchPlaying(cells: readonly DuelCell[]): DuelCell[] {
  return cells.filter((c) => c.mark === "later" || c.mark === "questionable" || c.mark === "live" || c.mark === "final");
}

// ---- moving between rows

/** The next team after `from` (wrapping) with something that needs the user; null when none does. */
export function nextNeeding(teams: readonly TeamOverview[], from: number): number | null {
  for (let step = 1; step <= teams.length; step++) {
    const i = (from + step) % teams.length;
    if (teams[i].state === "needs_you") return i;
  }
  return null;
}

// ---- Dime's last word on a team

export interface LastCheckin {
  title: string;
  /** The check-in's conversation in the AI desk; null when it left none. */
  conversationId: number | null;
  at: string;
}

/** Each team's most recent finished check-in: what a row Dime drives says, and where it leads. */
export function latestCheckins(checkins: readonly AiCheckin[] | null | undefined): Map<number, LastCheckin> {
  const out = new Map<number, LastCheckin>();
  for (const c of checkins ?? []) {
    if (c.state !== "done") continue;
    const at = c.finished_at ?? c.started_at;
    const have = out.get(c.team_id);
    // As instants: "22:00:00Z" sorts after "22:00:00.500Z" as text
    if (!have || Date.parse(at) > Date.parse(have.at)) out.set(c.team_id, { title: c.title, conversationId: c.conversation_id ?? null, at });
  }
  return out;
}
