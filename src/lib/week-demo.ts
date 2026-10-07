/**
 * A made-up mid-season week for `/week?demo`: Tuesday of week 4, an evening
 * with games final, live and still to tip. It exists so the page can be seen
 * (and its edge cases exercised) before the season starts and without a
 * backend: an OUT starter holding a slot, a bench player with a late game, a
 * future day with more games than slots, and a free-agent pool to preview.
 *
 * Every player, score and schedule here is sample data.
 */
import type { LineupPlanData, LineupPlayer, LineupState } from "@/types/lineup-editor";
import type { StreamerPlayer } from "@/types/streamer";
import type { BreakoutCandidateResp } from "@/types/breakout";
import type { ScheduleGame } from "@/types/games";
import type { DayGame, SourceOpponent, SourcePlayer, StatLine, WeekDay, WeekSource } from "./week-grid";
import { SLOT_NAMES, assignment, type Staged } from "./lineup-editor";

const PG = 0, SG = 1, SF = 2, PF = 3, C = 4, G = 5, F = 6, UT = 11, BE = 12, IR = 13;

const DATES = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY = 1;

export const DEMO_DAYS: WeekDay[] = DATES.map((date, index) => ({
  index,
  date,
  dow: DOW[index],
  kind: index < TODAY ? "past" : index === TODAY ? "today" : "future",
}));

/** [away, home, tip ET] per day. */
const SLATE: Array<Array<[string, string, string]>> = [
  [["SAS", "HOU", "20:00"], ["ATL", "CHI", "20:00"], ["LAC", "OKC", "19:30"], ["MEM", "PHX", "21:00"],
    ["CLE", "DET", "19:00"], ["LAL", "NOP", "20:00"], ["BKN", "NYK", "19:30"], ["ORL", "PHI", "19:00"]],
  [["HOU", "DEN", "19:00"], ["TOR", "MIA", "19:30"], ["OKC", "SAS", "20:30"], ["BOS", "LAL", "22:30"],
    ["PHI", "POR", "22:00"], ["DAL", "MIN", "20:00"], ["WAS", "ORL", "19:00"], ["DET", "GSW", "22:00"]],
  [["CHI", "TOR", "19:30"], ["IND", "CLE", "19:00"], ["NYK", "WAS", "19:00"], ["ORL", "ATL", "19:30"],
    ["MEM", "GSW", "22:00"], ["NOP", "MIL", "20:00"], ["UTA", "LAC", "22:30"], ["POR", "PHX", "21:00"]],
  [["DEN", "LAL", "22:00"], ["GSW", "OKC", "20:00"], ["MIA", "NYK", "19:30"], ["MIL", "MEM", "20:00"],
    ["BOS", "SAC", "22:00"]],
  [["DAL", "HOU", "20:00"], ["CLE", "ATL", "19:30"], ["TOR", "IND", "19:00"], ["SAS", "NOP", "20:00"],
    ["CHA", "PHI", "19:00"], ["ORL", "UTA", "21:00"]],
  [["MIN", "DEN", "21:00"], ["OKC", "POR", "22:00"], ["CHA", "CLE", "19:30"], ["MEM", "DAL", "20:30"],
    ["BOS", "GSW", "20:30"], ["SAC", "UTA", "21:00"]],
  [["DEN", "POR", "21:00"], ["HOU", "PHX", "21:00"], ["ATL", "BKN", "18:00"], ["WAS", "TOR", "18:00"],
    ["NOP", "MIN", "19:00"], ["PHI", "NYK", "19:30"], ["BOS", "LAC", "21:30"], ["DET", "SAC", "21:00"]],
];

function gameOn(team: string, day: number): { opp: string; time: string } | null {
  for (const [away, home, time] of SLATE[day]) {
    if (away === team) return { opp: `@ ${home}`, time };
    if (home === team) return { opp: `vs ${away}`, time };
  }
  return null;
}

/**
 * A plausible box score for `fpts` (made up: shares of the total, rounded).
 * `share` < 1 is a game in progress.
 */
function demoLine(fpts: number, share = 1): StatLine {
  const pts = Math.round(fpts * 0.52);
  const fga = Math.max(1, Math.round(pts / 2.15));
  const fta = Math.round(pts * 0.22);
  return {
    min: Math.round(34 * share),
    pts,
    reb: Math.round(fpts * 0.21),
    ast: Math.round(fpts * 0.12),
    stl: Math.round(fpts / 30),
    blk: Math.round(fpts / 38),
    tov: Math.max(0, Math.round(fpts / 22)),
    fgm: Math.round(fga * 0.49),
    fga,
    ftm: Math.round(fta * 0.8),
    fta,
    fg3m: Math.round(pts * 0.09),
  };
}

/** Points a player scored on a played day, and today's live state. */
interface Line {
  mon?: number;
  tue?: { fpts: number; status: "live" | "final"; clock?: string; remaining?: number };
}

function games(team: string, line: Line, out: boolean): Array<DayGame | null> {
  return DEMO_DAYS.map((d) => {
    const g = gameOn(team, d.index);
    if (!g) return null;
    if (d.kind === "past") {
      const fpts = line.mon ?? null;
      return {
        opp: g.opp, time: g.time, status: "final", fpts, clock: null, remaining: 0, out: false,
        line: fpts != null ? demoLine(fpts) : null,
      };
    }
    if (d.kind === "today" && line.tue) {
      const t = line.tue;
      const remaining = t.status === "final" ? 0 : t.remaining ?? 0.5;
      return {
        opp: g.opp, time: g.time, status: t.status, fpts: t.fpts,
        clock: t.clock ?? null, remaining, out: false, line: demoLine(t.fpts, 1 - remaining),
      };
    }
    return { opp: g.opp, time: g.time, status: "scheduled", fpts: null, clock: null, remaining: 1, out };
  });
}

interface MineSpec {
  id: number; nbaId: number; name: string; team: string; slot: number; eligible: number[];
  avg: number; injury?: string; line?: Line;
}

const MINE: MineSpec[] = [
  { id: 4431678, nbaId: 1630178, name: "Tyrese Maxey", team: "PHI", slot: PG, eligible: [PG, G, UT], avg: 40.0, injury: "OUT", line: { mon: 38.5 } },
  { id: 4593803, nbaId: 1631114, name: "Jalen Williams", team: "OKC", slot: SG, eligible: [SG, SF, G, F, UT], avg: 42.0, line: { mon: 41.0, tue: { fpts: 21.5, status: "live", clock: "Q2 7:48", remaining: 0.66 } } },
  { id: 4433134, nbaId: 1630567, name: "Scottie Barnes", team: "TOR", slot: SF, eligible: [SF, PF, F, UT], avg: 41.0, line: { tue: { fpts: 44.0, status: "final" } } },
  { id: 4277961, nbaId: 1628991, name: "Jaren Jackson Jr.", team: "MEM", slot: PF, eligible: [PF, C, F, UT], avg: 38.5, line: { mon: 40.5 } },
  { id: 3112335, nbaId: 203999, name: "Nikola Jokić", team: "DEN", slot: C, eligible: [C, UT], avg: 57.5, line: { tue: { fpts: 41.5, status: "live", clock: "Q3 4:12", remaining: 0.34 } } },
  { id: 3908809, nbaId: 1629636, name: "Darius Garland", team: "CLE", slot: G, eligible: [PG, G, UT], avg: 35.5, line: { mon: 36.0 } },
  { id: 4701230, nbaId: 1630552, name: "Jalen Johnson", team: "ATL", slot: F, eligible: [SF, PF, F, UT], avg: 45.0, line: { mon: 47.0 } },
  { id: 4871144, nbaId: 1630578, name: "Alperen Şengün", team: "HOU", slot: UT, eligible: [C, UT], avg: 45.0, line: { mon: 44.5, tue: { fpts: 33.0, status: "live", clock: "Q3 4:12", remaining: 0.34 } } },
  { id: 4397002, nbaId: 1630530, name: "Trey Murphy III", team: "NOP", slot: UT, eligible: [SF, PF, F, UT], avg: 34.0, line: { mon: 37.5 } },
  { id: 4278073, nbaId: 1628404, name: "Josh Hart", team: "NYK", slot: UT, eligible: [PG, SG, SF, G, F, UT], avg: 32.5, line: { mon: 33.5 } },
  { id: 3078576, nbaId: 1628401, name: "Derrick White", team: "BOS", slot: BE, eligible: [PG, SG, G, UT], avg: 33.5 },
  { id: 4433136, nbaId: 1631117, name: "Walker Kessler", team: "UTA", slot: BE, eligible: [C, UT], avg: 28.0 },
  { id: 4594327, nbaId: 1631099, name: "Keegan Murray", team: "SAC", slot: BE, eligible: [SF, PF, F, UT], avg: 26.0 },
];

interface OppSpec {
  id: number; nbaId: number; name: string; team: string; avg: number; slot: string; line?: Line; injury?: string;
}

const OPP: OppSpec[] = [
  { id: 4594268, nbaId: 1630162, name: "Anthony Edwards", team: "MIN", avg: 50.0, slot: "SG", line: { tue: { fpts: 48.5, status: "live", clock: "Q3 2:05", remaining: 0.29 } } },
  { id: 4066261, nbaId: 1628389, name: "Bam Adebayo", team: "MIA", avg: 40.5, slot: "C", line: { tue: { fpts: 39.0, status: "final" } } },
  { id: 4432573, nbaId: 1631094, name: "Paolo Banchero", team: "ORL", avg: 44.5, slot: "SF", line: { mon: 41.0, tue: { fpts: 44.0, status: "live", clock: "Q4 9:30", remaining: 0.2 } } },
  { id: 4432166, nbaId: 1630595, name: "Cade Cunningham", team: "DET", avg: 47.0, slot: "G", line: { mon: 46.5 } },
  { id: 4066457, nbaId: 1630559, name: "Austin Reaves", team: "LAL", avg: 36.0, slot: "UT", line: { mon: 35.0 } },
  { id: 3934672, nbaId: 1628973, name: "Jalen Brunson", team: "NYK", avg: 45.5, slot: "PG", line: { mon: 44.0 } },
  { id: 4433255, nbaId: 1631096, name: "Chet Holmgren", team: "OKC", avg: 38.0, slot: "F", line: { mon: 37.5, tue: { fpts: 18.0, status: "live", clock: "Q2 7:48", remaining: 0.66 } } },
  { id: 3155942, nbaId: 1627734, name: "Domantas Sabonis", team: "SAC", avg: 47.5, slot: "UT" },
  { id: 4278049, nbaId: 1629627, name: "Zion Williamson", team: "NOP", avg: 41.5, slot: "PF", line: { mon: 42.0 } },
  { id: 5104157, nbaId: 1641705, name: "Victor Wembanyama", team: "SAS", avg: 56.0, slot: "UT", line: { mon: 55.0, tue: { fpts: 27.0, status: "live", clock: "Q2 7:48", remaining: 0.66 } } },
  { id: 4395725, nbaId: 1629639, name: "Tyler Herro", team: "MIA", avg: 33.0, slot: "BE", line: { tue: { fpts: 31.5, status: "final" } } },
  { id: 4683021, nbaId: 1642276, name: "Kel'el Ware", team: "MIA", avg: 29.0, slot: "BE", line: { tue: { fpts: 22.0, status: "final" } } },
  { id: 4066336, nbaId: 1628374, name: "Lauri Markkanen", team: "UTA", avg: 35.5, slot: "BE" },
];

function lineupPlayer(s: MineSpec, slot: number = s.slot, day: number = TODAY): LineupPlayer {
  const g = gameOn(s.team, day);
  const started = day === TODAY && !!s.line?.tue;
  const out = s.injury === "OUT";
  const eligible = [...s.eligible, BE, ...(out ? [IR] : [])];
  return {
    player_id: s.id,
    nba_player_id: s.nbaId,
    name: s.name,
    team: s.team,
    lineup_slot_id: slot,
    lineup_slot: SLOT_NAMES[slot],
    eligible_slot_ids: eligible,
    eligible_slots: eligible.map((x) => SLOT_NAMES[x]),
    injured: out,
    injury_status: s.injury ?? null,
    default_position_id: null,
    lineup_locked: false,
    has_game_today: !!g,
    opponent: g?.opp ?? null,
    game_time_et: g?.time ?? null,
    game_started: started,
    locked: started,
    playable: !!g && !out,
    avg_points: s.avg,
    value_kind: "fpts",
    value_source: "rolling",
  };
}

/** ESPN day number of a demo day (Tuesday, today, is day 23 of the season). */
export const demoPeriod = (day: number) => 22 + day;

/**
 * The demo team's ESPN lineup for `day` (today or later). `slots` overrides
 * where players sit (an edit); otherwise everyone is where the roster spec says.
 */
export function demoBoard(
  roster: MineSpec[] = MINE,
  version = "demo-1",
  day: number = TODAY,
  slots?: Readonly<Record<number, number>>
): LineupState {
  return {
    provider: "espn",
    team_name: "Paint Beasts",
    espn_team_id: 1,
    nba_date: DATES[day],
    scoring_period_id: demoPeriod(day),
    current_scoring_period_id: demoPeriod(TODAY),
    final_scoring_period_id: 167,
    scoring_period_source: "provider",
    first_game_time_et: "19:00",
    slot_counts: { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 0, "8": 0, "9": 0, "10": 0, "11": 3, "12": 3, "13": 1 },
    position_limits: {},
    slots: [
      { slot_id: PG, slot: "PG", count: 1 }, { slot_id: SG, slot: "SG", count: 1 },
      { slot_id: SF, slot: "SF", count: 1 }, { slot_id: PF, slot: "PF", count: 1 },
      { slot_id: C, slot: "C", count: 1 }, { slot_id: G, slot: "G", count: 1 },
      { slot_id: F, slot: "F", count: 1 }, { slot_id: UT, slot: "UT", count: 3 },
      { slot_id: BE, slot: "BE", count: 3 }, { slot_id: IR, slot: "IR", count: 1 },
    ],
    lock_type: "INDIVIDUAL_GAME",
    players: roster.map((s) => lineupPlayer(s, slots?.[s.id] ?? s.slot, day)),
    can_write: true,
    write_blocked_reason: null,
    roster_version: version,
    fetched_at: `${DATES[TODAY]}T02:55:00Z`,
  };
}

/** What the server's fill-only planner answers for the demo board: White starts for the OUT Maxey. */
export function demoPlan(board: LineupState): LineupPlanData {
  const white = board.players.find((p) => p.name === "Derrick White");
  const maxey = board.players.find((p) => p.name === "Tyrese Maxey");
  const moves =
    white && maxey && white.lineup_slot_id === BE && maxey.lineup_slot_id === PG
      ? [
          { player_id: white.player_id, name: white.name, from_slot_id: BE, from_slot: "BE", to_slot_id: PG, to_slot: "PG", role: "start" as const, note: "Game at 10:30 PM" },
          { player_id: maxey.player_id, name: maxey.name, from_slot_id: PG, from_slot: "PG", to_slot_id: BE, to_slot: "BE", role: "bench" as const, note: "Ruled out" },
        ]
      : [];
  return {
    moves,
    unfilled: [],
    summary: moves.length ? "Start Derrick White for Tyrese Maxey" : "Your lineup is already set",
    nba_date: board.nba_date,
    roster_version: board.roster_version,
    scoring_period_id: board.scoring_period_id,
  };
}

/**
 * Where everyone sits on `day`, ESPN's way: the latest day at or before it
 * that has its own edit wins; with none, the roster spec's slots.
 */
export function demoAssignment(
  roster: MineSpec[],
  edits: Readonly<Record<number, Readonly<Record<number, number>>>>,
  day: number
): Record<number, number> {
  const out: Record<number, number> = Object.fromEntries(roster.map((s) => [s.id, s.slot]));
  for (let d = TODAY; d <= day; d++) {
    const edit = edits[d];
    if (edit) for (const s of roster) if (edit[s.id] !== undefined) out[s.id] = edit[s.id];
  }
  return out;
}

export { TODAY as DEMO_TODAY };

/** The board as the server would re-read it after the staged moves. */
export function demoApply(state: LineupState, staged: Staged): LineupState {
  const assign = assignment(state, staged);
  const n = Number(state.roster_version.split("-").pop()) || 1;
  return {
    ...state,
    roster_version: `demo-${n + 1}`,
    players: state.players.map((p) => {
      const slot = assign.get(p.player_id) ?? p.lineup_slot_id;
      return { ...p, lineup_slot_id: slot, lineup_slot: SLOT_NAMES[slot] };
    }),
  };
}

function sourcePlayer(s: MineSpec): SourcePlayer {
  return {
    id: s.id, name: s.name, team: s.team, nbaId: s.nbaId, avg: s.avg,
    injury: s.injury ?? null, eligible: s.eligible,
    games: games(s.team, s.line ?? {}, s.injury === "OUT"),
  };
}

const INACTIVE = new Set(["BE", "IR"]);

function sourceOpponent(s: OppSpec): SourceOpponent {
  return {
    id: s.id,
    name: s.name,
    avg: s.avg,
    active: !INACTIVE.has(s.slot),
    games: games(s.team, s.line ?? {}, false),
    team: s.team,
    nbaId: s.nbaId,
    slot: s.slot,
    injury: s.injury ?? null,
  };
}

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;

export function demoSource(roster: MineSpec[] = MINE): WeekSource {
  const mine = roster.map(sourcePlayer);
  const opponents = OPP.map(sourceOpponent);
  const youToday = sum(roster.filter((s) => s.slot !== BE && s.slot !== IR).map((s) => s.line?.tue?.fpts ?? 0));
  const oppToday = sum(OPP.filter((s) => !INACTIVE.has(s.slot)).map((s) => s.line?.tue?.fpts ?? 0));
  const youMon = sum(MINE.map((s) => s.line?.mon ?? 0));
  const oppMon = sum(OPP.map((s) => s.line?.mon ?? 0));
  return {
    period: 4,
    days: DEMO_DAYS,
    todayIndex: TODAY,
    you: { name: "Paint Beasts", current: sum([youMon, youToday]) },
    opp: { name: "Splash Dept.", current: sum([oppMon, oppToday]) },
    mine,
    opponents,
    pastTotals: { you: [youMon, null, null, null, null, null, null], opp: [oppMon, null, null, null, null, null, null] },
    activeSlotCount: 10,
  };
}

// ---- free agents ----

interface FaSpec {
  id: number; nbaId: number; name: string; team: string; positions: string[]; avg: number; season: number; score: number;
  injury?: string; waiversUntil?: string;
}

const FREE_AGENTS: FaSpec[] = [
  { id: 4683749, nbaId: 1641739, name: "Toumani Camara", team: "POR", positions: ["SF", "PF", "F", "UT"], avg: 30.2, season: 28.9, score: 88 },
  { id: 4869342, nbaId: 1630700, name: "Dyson Daniels", team: "ATL", positions: ["PG", "SG", "G", "UT"], avg: 33.0, season: 31.4, score: 84 },
  { id: 4683678, nbaId: 1641709, name: "Ausar Thompson", team: "DET", positions: ["SG", "SF", "G", "F", "UT"], avg: 31.0, season: 29.6, score: 71 },
  { id: 4066372, nbaId: 1630230, name: "Naji Marshall", team: "DAL", positions: ["SF", "F", "UT"], avg: 28.0, season: 26.8, score: 66 },
  { id: 4278052, nbaId: 1630643, name: "Jay Huff", team: "IND", positions: ["C", "UT"], avg: 27.5, season: 25.2, score: 61 },
  { id: 3448, nbaId: 201572, name: "Brook Lopez", team: "LAC", positions: ["C", "UT"], avg: 27.0, season: 26.1, score: 58 },
  { id: 3934721, nbaId: 1629048, name: "Goga Bitadze", team: "ORL", positions: ["C", "UT"], avg: 24.0, season: 23.0, score: 49 },
  { id: 4592410, nbaId: 1631165, name: "Keon Ellis", team: "SAC", positions: ["SG", "G", "UT"], avg: 22.0, season: 21.3, score: 44 },
  { id: 4431785, nbaId: 1641718, name: "Keyonte George", team: "UTA", positions: ["PG", "SG", "G", "UT"], avg: 31.5, season: 29.8, score: 74 },
  { id: 4397077, nbaId: 1630590, name: "Scotty Pippen Jr.", team: "MEM", positions: ["PG", "SG", "G", "UT"], avg: 27.5, season: 24.0, score: 63 },
  { id: 4433139, nbaId: 1631106, name: "Tari Eason", team: "HOU", positions: ["SF", "PF", "F", "UT"], avg: 27.0, season: 26.2, score: 60, injury: "DAY_TO_DAY" },
  { id: 4431685, nbaId: 1631212, name: "Peyton Watson", team: "DEN", positions: ["SF", "PF", "F", "UT"], avg: 23.5, season: 22.1, score: 57 },
  { id: 4683686, nbaId: 1641711, name: "Gradey Dick", team: "TOR", positions: ["SG", "SF", "G", "F", "UT"], avg: 24.5, season: 23.2, score: 56 },
  { id: 4683745, nbaId: 1641731, name: "Bilal Coulibaly", team: "WAS", positions: ["SG", "SF", "G", "F", "UT"], avg: 25.0, season: 24.4, score: 53 },
  { id: 4432907, nbaId: 1631157, name: "Ryan Rollins", team: "MIL", positions: ["PG", "SG", "G", "UT"], avg: 26.5, season: 22.9, score: 52 },
  { id: 4432816, nbaId: 1631217, name: "Moussa Diabaté", team: "CHA", positions: ["PF", "C", "F", "UT"], avg: 24.0, season: 21.7, score: 50 },
  { id: 4278104, nbaId: 1630541, name: "Moses Moody", team: "GSW", positions: ["SG", "SF", "G", "F", "UT"], avg: 21.0, season: 20.5, score: 48 },
  { id: 4873138, nbaId: 1642267, name: "Bub Carrington", team: "WAS", positions: ["PG", "SG", "G", "UT"], avg: 22.0, season: 19.8, score: 46, waiversUntil: "2026-11-11" },
  { id: 3907498, nbaId: 1627739, name: "Kris Dunn", team: "LAC", positions: ["PG", "SG", "G", "UT"], avg: 22.5, season: 21.6, score: 41, injury: "DAY_TO_DAY" },
  { id: 4278591, nbaId: 1630208, name: "Nick Richards", team: "PHX", positions: ["C", "UT"], avg: 22.0, season: 20.9, score: 40 },
  { id: 4397013, nbaId: 1630534, name: "Ochai Agbaji", team: "TOR", positions: ["SG", "SF", "G", "F", "UT"], avg: 19.0, season: 18.2, score: 39 },
  { id: 4065731, nbaId: 1630241, name: "Sam Merrill", team: "CLE", positions: ["SG", "G", "UT"], avg: 18.0, season: 17.4, score: 35 },
  { id: 4278080, nbaId: 1630174, name: "Aaron Nesmith", team: "IND", positions: ["SF", "F", "UT"], avg: 20.0, season: 19.6, score: 33 },
  { id: 4432810, nbaId: 1631101, name: "Day'Ron Sharpe", team: "BKN", positions: ["C", "UT"], avg: 22.0, season: 20.1, score: 30 },
];

/** Remaining game days from today, as the streamer search reports them (today's included). */
function remainingDays(team: string): number[] {
  return DEMO_DAYS.filter((d) => d.index >= TODAY && gameOn(team, d.index)).map((d) => d.index);
}

/** Back-to-backs among a team's remaining games. */
function backToBacks(days: number[]): number {
  return days.filter((d, i) => i > 0 && days[i - 1] === d - 1).length;
}

export const DEMO_STREAMERS: StreamerPlayer[] = FREE_AGENTS.map((f) => {
  const days = remainingDays(f.team);
  const b2b = backToBacks(days);
  return {
    player_id: f.id,
    nba_player_id: f.nbaId,
    name: f.name,
    team: f.team,
    valid_positions: f.positions,
    avg_points_last_n: f.avg,
    avg_points_season: f.season,
    avg_source: "rolling",
    streamer_score: f.score,
    game_days: days,
    games_remaining: days.length,
    b2b_game_count: b2b,
    has_b2b: b2b > 0,
    injured: !!f.injury,
    injury_status: f.injury ?? null,
    acquisition_status: f.waiversUntil ? "waivers" : "free_agent",
    waivers_until: f.waiversUntil ?? null,
    default_position_id: null,
  };
});

/** The single-day search: free agents with a game on `day`, best for the day first. */
export function demoDailyStreamers(day: number): StreamerPlayer[] {
  return DEMO_STREAMERS.filter((f) => f.game_days.includes(day)).sort((a, b) => (b.avg_points_last_n ?? 0) - (a.avg_points_last_n ?? 0));
}

const byName = (name: string) => FREE_AGENTS.find((f) => f.name === name)!;

/** Breakout candidates: a starter out, the player whose minutes grow. One is not a free agent in the demo league. */
export const DEMO_BREAKOUTS: BreakoutCandidateResp[] = [
  {
    injured_player: { player_id: 4277905, name: "Trae Young", avg_min: 35.1, status: "OUT", expected_return: "2026-11-20" },
    beneficiary: { player_id: byName("Dyson Daniels").id, nba_player_id: byName("Dyson Daniels").nbaId, name: "Dyson Daniels", team: "ATL", position: "PG", depth_rank: 2, avg_min: 31.2, avg_fpts: 33.0, games_remaining: 3, has_b2b: false },
    signals: { depth_rank: 2, projected_min_boost: 8.5, opp_min_avg: 36.4, opp_fpts_avg: 39.1, opp_game_count: 7, breakout_score: 82 },
  },
  {
    injured_player: { player_id: 4279888, name: "Ja Morant", avg_min: 30.4, status: "OUT", expected_return: null },
    beneficiary: { player_id: byName("Scotty Pippen Jr.").id, nba_player_id: byName("Scotty Pippen Jr.").nbaId, name: "Scotty Pippen Jr.", team: "MEM", position: "PG", depth_rank: 2, avg_min: 24.8, avg_fpts: 27.5, games_remaining: 3, has_b2b: false },
    signals: { depth_rank: 2, projected_min_boost: 10.9, opp_min_avg: 33.0, opp_fpts_avg: 34.1, opp_game_count: 5, breakout_score: 78 },
  },
  {
    injured_player: { player_id: 4701232, name: "Mark Williams", avg_min: 27.0, status: "OUT", expected_return: "2026-11-16" },
    beneficiary: { player_id: byName("Moussa Diabaté").id, nba_player_id: byName("Moussa Diabaté").nbaId, name: "Moussa Diabaté", team: "CHA", position: "C", depth_rank: 2, avg_min: 19.5, avg_fpts: 24.0, games_remaining: 2, has_b2b: true },
    signals: { depth_rank: 2, projected_min_boost: 12.1, opp_min_avg: 30.2, opp_fpts_avg: 29.8, opp_game_count: 4, breakout_score: 71 },
  },
  {
    injured_player: { player_id: 3059318, name: "Joel Embiid", avg_min: 32.8, status: "OUT", expected_return: null },
    beneficiary: { player_id: 3133603, nba_player_id: 1626162, name: "Kelly Oubre Jr.", team: "PHI", position: "SF", depth_rank: 1, avg_min: 30.1, avg_fpts: 30.5, games_remaining: 3, has_b2b: false },
    signals: { depth_rank: 1, projected_min_boost: 4.2, opp_min_avg: 33.5, opp_fpts_avg: 34.0, opp_game_count: 9, breakout_score: 64 },
  },
];

/** A team's demo schedule, shaped like `GET /teams/{abbrev}/schedule`. */
export function demoSchedule(team: string): ScheduleGame[] {
  return DEMO_DAYS.flatMap((d) => {
    const g = gameOn(team, d.index);
    if (!g) return [];
    const started = d.kind === "past" || (d.kind === "today" && g.time < "21:55");
    return [{
      date: d.date,
      opponent: g.opp.split(" ")[1],
      home: g.opp.startsWith("vs"),
      back_to_back: false,
      status: started ? (d.kind === "past" ? "final" : "in_progress") : "scheduled",
      team_score: null,
      opponent_score: null,
      opponent_def_rating: null,
    }];
  });
}

/** The roster after a demo add/drop: the added player lands on the bench. */
export function demoTransact(roster: MineSpec[], addId: number | null, dropId: number | null): MineSpec[] {
  let next = dropId != null ? roster.filter((s) => s.id !== dropId) : roster;
  const fa = FREE_AGENTS.find((f) => f.id === addId);
  if (fa) {
    next = [...next, {
      id: fa.id, nbaId: fa.nbaId, name: fa.name, team: fa.team, slot: BE, injury: fa.injury,
      eligible: fa.positions.map((p) => ({ PG, SG, SF, PF, C, G, F, UT } as Record<string, number>)[p]).filter((x) => x !== undefined),
      avg: fa.avg,
    }];
  }
  return next;
}

export { MINE as DEMO_ROSTER };
export type { MineSpec as DemoRosterSpec };
