/**
 * The Home desk's demo: a made-up account with five teams on one Thursday night, two games
 * under way. One team needs a swap before a tip, one has an IR move to take or leave, two are
 * set and Dime drives the last. They stand as the server orders them, most pressing first: what
 * can be done on a team weighed by how close its week is, the weeks all but settled last.
 * Nothing here is real and nothing is sent anywhere: the page
 * opens signed out, so team, league and opponent names are invented too (the first team carries
 * the Week demo's names).
 */
import type { DailyAction } from "@/types/daily-actions";
import type { GamesOnDateData } from "@/types/games";
import type { LiveMatchupData, LiveMatchupPlayer } from "@/types/matchup";
import type { OverviewDay, OverviewItem, OverviewSeat, SeatMark, TeamOverview, TeamsOverviewData } from "@/types/team-overview";
import { etInstant } from "./local-time";

export const HOME_DEMO_DATE = "2026-11-19";
/** Thursday 7:42 PM ET. */
export const HOME_DEMO_NOW = etInstant(HOME_DEMO_DATE, "19:42")!;

const at = (hhmm: string, date: string = HOME_DEMO_DATE) => new Date(etInstant(date, hhmm)!).toISOString();

// ---- the night's games: [away, home, tip ET, on?]

const GAMES: Array<[string, string, string, boolean]> = [
  ["BOS", "ORL", "19:00", true],
  ["DET", "ATL", "19:00", true],
  ["HOU", "MIL", "19:30", true],
  ["DAL", "CHI", "20:00", false],
  ["CLE", "MIA", "20:00", false],
  ["PHX", "DEN", "21:00", false],
  ["MIN", "UTA", "21:00", false],
  ["PHI", "POR", "22:00", false],
  ["OKC", "LAL", "22:00", false],
];
const TIP = new Map<string, { tip: string; on: boolean; opp: string }>();
for (const [away, home, tip, on] of GAMES) {
  TIP.set(away, { tip, on, opp: `@ ${home}` });
  TIP.set(home, { tip, on, opp: `vs ${away}` });
}

export const HOME_DEMO_SLATE: GamesOnDateData = {
  date: HOME_DEMO_DATE,
  count: GAMES.length,
  live_age_ms: null,
  games: GAMES.map(([away, home, tip, on], i) => ({
    game_id: `demo-${i}`,
    game_date: HOME_DEMO_DATE,
    away_team: away,
    home_team: home,
    start_time_et: tip,
    status: on ? "in_progress" : "scheduled",
    away_score: on ? 38 + i * 3 : null,
    home_score: on ? 41 + i * 2 : null,
    period: on ? 2 : null,
    game_clock: on ? "6:12" : null,
    arena: null,
  })) as GamesOnDateData["games"],
};

// ---- players: [name, NBA team, tonight's points if his game is on, status]

type P = [name: string, team: string, points?: number, status?: "OUT" | "Q"];

let nextId = 9000;
const ids = new Map<string, number>();
const idOf = (name: string) => ids.get(name) ?? (ids.set(name, ++nextId), nextId);

function markOf([, team, , status]: P): SeatMark {
  const g = TIP.get(team);
  if (!g) return "idle";
  if (status === "OUT") return "out";
  if (g.on) return "live";
  return status === "Q" ? "questionable" : "later";
}

function seat(slot: string, slotId: number, p: P | null): OverviewSeat {
  if (!p) return { slot, slot_id: slotId, mark: "empty", player_id: null, nba_player_id: null, name: null, team: null, injury_status: null, opponent: null, game_time_et: null, points: null };
  const g = TIP.get(p[1]);
  const mark = markOf(p);
  return {
    slot,
    slot_id: slotId,
    mark,
    player_id: idOf(p[0]),
    nba_player_id: null,
    name: p[0],
    team: p[1],
    injury_status: p[3] === "OUT" ? "OUT" : p[3] === "Q" ? "QUESTIONABLE" : null,
    opponent: g?.opp ?? null,
    game_time_et: g?.tip ?? null,
    points: mark === "live" ? (p[2] ?? 0) : null,
  };
}

function rosterPlayer(slot: string, p: P): LiveMatchupPlayer {
  const mark = markOf(p);
  return {
    player_id: idOf(p[0]),
    nba_player_id: null,
    name: p[0],
    team: p[1],
    position: slot,
    lineup_slot: slot,
    avg_points: 34,
    projected_points: 102,
    games_remaining: 2,
    injured: p[3] === "OUT",
    injury_status: p[3] === "OUT" ? "OUT" : p[3] === "Q" ? "QUESTIONABLE" : null,
    live:
      mark === "live"
        ? ({ nba_player_id: 0, game_status: 2, period: 2, game_clock: "6:12", last_updated: null, live_fpts: p[2] ?? 0, live_min: 14, live_pts: 8, live_reb: 3, live_ast: 2, live_stl: 0, live_blk: 0, live_tov: 1, live_fgm: 3, live_fga: 7, live_fg3m: 1, live_fg3a: 3, live_ftm: 1, live_fta: 2 } as LiveMatchupPlayer["live"])
        : null,
  };
}

const SLOTS: Array<[string, number]> = [["PG", 0], ["SG", 1], ["SF", 2], ["PF", 3], ["C", 4], ["G", 5], ["F", 6], ["UT", 11], ["UT", 11], ["UT", 11]];

interface Side {
  starters: Array<P | null>;
  bench: P[];
}

function tonightOf(side: Side): NonNullable<TeamOverview["tonight"]> {
  const seats = SLOTS.map(([slot, id], i) => seat(slot, id, side.starters[i] ?? null));
  const counts: Record<string, number> = { live: 0, later: 0, final: 0, questionable: 0, out: 0, idle: 0, empty: 0 };
  for (const s of seats) counts[s.mark] += 1;
  const tips = seats.filter((s) => s.mark === "later" || s.mark === "questionable").map((s) => s.game_time_et!).sort();
  const all = seats.filter((s) => s.game_time_et).map((s) => s.game_time_et!).sort();
  const points = seats.reduce((a, s) => a + (s.points ?? 0), 0);
  return {
    first_tip_et: all[0] ?? null,
    next_lock_et: tips[0] ?? null,
    next_lock_at: tips[0] ? at(tips[0]) : null,
    seats,
    bench: side.bench.map((p) => seat("BE", 12, p)),
    ir: [],
    counts,
    points: counts.live ? points : null,
  };
}

function liveOf(teamId: number, name: string, mine: Side, oppName: string, theirs: Side): LiveMatchupData {
  const roster = (side: Side) => [
    ...side.starters.flatMap((p, i) => (p ? [rosterPlayer(SLOTS[i][0], p)] : [])),
    ...side.bench.map((p) => rosterPlayer("BE", p)),
  ];
  return {
    matchup_period: 5,
    matchup_period_start: "2026-11-16",
    matchup_period_end: "2026-11-22",
    game_date: HOME_DEMO_DATE,
    scoring_format: "points",
    settings_synced: true,
    baseline_stale_days: 0,
    live_age_ms: null,
    provider_read_ms: null,
    category_comparison: null,
    projected_margin: 0,
    projected_winner: name,
    your_team: { team_id: teamId, team_name: name, current_score: 0, projected_score: 0, categories: null, roster: roster(mine) },
    opponent_team: { team_id: teamId + 100, team_name: oppName, current_score: 0, projected_score: 0, categories: null, roster: roster(theirs) },
  };
}

// ---- the week: three days played, today, three ahead

function weekOf(past: Array<[number, number]>, today: [number, number], ahead: Array<[number, number]>, categories = false): OverviewDay[] {
  const dates = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"];
  const day = (i: number, kind: OverviewDay["kind"], you: number | null, opp: number | null, yg: number, og: number): OverviewDay => ({
    date: dates[i], kind, your_points: categories ? null : you, opponent_points: categories ? null : opp, your_games: yg, opponent_games: og, estimated: false,
  });
  return [
    ...past.map(([a, b], i) => day(i, "past", a, b, categories ? a : 7, categories ? b : 7)),
    day(3, "today", today[0], today[1], categories ? today[0] : 9, categories ? today[1] : 7),
    ...ahead.map(([a, b], i) => day(4 + i, "future", null, null, a, b)),
  ];
}

function action(kind: DailyAction["kind"], id: string, title: string, detail: string, player: P, slot: string, tip: string | null): DailyAction {
  return {
    id,
    kind,
    title,
    detail,
    blocked_reason: null,
    game_time_et: tip,
    counterpart: null,
    transaction: null,
    moves: [],
    player: { player_id: idOf(player[0]), nba_player_id: null, name: player[0], team: player[1], lineup_slot: slot, lineup_slot_id: null, avg_points: 34, injury_status: player[3] === "OUT" ? "OUT" : null },
  };
}

const item = (standing: OverviewItem["standing"], a: DailyAction, deadline: string | null = null, coveredBy: OverviewItem["covered_by"] = null): OverviewItem => ({
  standing,
  covered_by: coveredBy,
  deadline_et: deadline,
  deadline_at: deadline ? at(deadline) : null,
  action: a,
});

// ---- the five teams

const IRVING: P = ["Kyrie Irving", "DAL", 0, "OUT"];
const CLINGAN: P = ["Donovan Clingan", "POR"];
const HARRIS: P = ["Tobias Harris", "DET", 0, "OUT"];

const BEASTS: Side = {
  starters: [
    ["Daniel Jenkins", "DET", 11.5], ["Anthony Black", "ORL", 14], ["Jayson Tatum", "BOS", 16], ["Cameron Boozer", "UTA"], ["Aday Mara", "DEN"],
    IRVING, ["Andrew Wiggins", "MIA"], ["Tyrese Maxey", "PHI"], ["Donovan Mitchell", "CLE"], ["Josh Giddey", "CHI"],
  ],
  bench: [CLINGAN, ["Fred VanVleet", "NYK"], ["Keyonte George", "GSW"]],
};
const SPLASH: Side = {
  starters: [
    ["Cade Cunningham", "DET", 12.5], ["Devin Booker", "PHX"], ["Franz Wagner", "ORL", 9], ["Evan Mobley", "CLE"], ["Alperen Sengun", "HOU", 16.5],
    ["Jalen Brunson", "NYK"], ["Jalen Johnson", "ATL", 0], ["Deni Avdija", "POR"], ["Cam Thomas", "BKN"], ["Brandon Miller", "CHA"],
  ],
  bench: [["Jalen Duren", "DET", 7], ["Coby White", "CHI"], ["Naz Reid", "GSW"], ["Kel'el Ware", "SAS"]],
};

const POOL: P[] = [
  ["Jalen Suggs", "ORL", 9.5], ["Derrick White", "BOS", 13], ["Dyson Daniels", "ATL", 15.5], ["Amen Thompson", "HOU", 12], ["Myles Turner", "MIL", 8.5],
  ["Cooper Flagg", "DAL"], ["Coby White", "CHI"], ["Bam Adebayo", "MIA"], ["Darius Garland", "CLE"], ["Jamal Murray", "DEN"],
  ["Anthony Edwards", "MIN"], ["Lauri Markkanen", "UTA"], ["Shaedon Sharpe", "POR"], ["Chet Holmgren", "OKC"], ["Austin Reaves", "LAL"],
  ["Paolo Banchero", "ORL", 18], ["Jaylen Brown", "BOS", 14.5], ["Trae Young", "ATL", 17], ["Jabari Smith Jr.", "HOU", 6.5], ["Damian Lillard", "MIL", 11],
  ["Nikola Jokić", "DEN"], ["Rudy Gobert", "MIN"], ["Walker Kessler", "UTA"], ["Jalen Williams", "OKC"], ["LeBron James", "LAL"],
  ["Tyler Herro", "MIA"], ["Jarrett Allen", "CLE"], ["Nikola Vučević", "CHI"], ["Kevin Durant", "PHX"], ["Joel Embiid", "PHI"],
  ["OG Anunoby", "NYK"], ["LaMelo Ball", "CHA"], ["Stephen Curry", "GSW"], ["Victor Wembanyama", "SAS"], ["Nic Claxton", "BKN"],
  ["Ausar Thompson", "DET", 10], ["Onyeka Okongwu", "ATL", 9], ["Giannis Antetokounmpo", "MIL", 0, "OUT"], ["Isaiah Hartenstein", "OKC"], ["Tyrese Haliburton", "LAL", 0, "Q"],
];
const pick = (from: number[]): Array<P | null> => from.map((i) => (i < 0 ? null : POOL[i]));

const SIDES: Record<number, { mine: Side; theirs: Side }> = {
  25: { mine: BEASTS, theirs: SPLASH },
  21: { mine: { starters: pick([0, 1, 16, 18, 4, 6, 7, 30, 31, 34]), bench: [POOL[26], POOL[33], HARRIS] }, theirs: { starters: pick([2, 3, 15, 19, 20, 8, 9, 32, 33, 30]), bench: [POOL[10], POOL[27]] } },
  23: { mine: { starters: pick([17, 3, 15, 5, 20, 8, 39, 11, 12, 13]), bench: [POOL[22], POOL[31]] }, theirs: { starters: pick([0, 36, 16, 7, 21, 9, 25, 28, 14, 34]), bench: [POOL[29], POOL[32]] } },
  24: { mine: { starters: pick([2, 1, 16, 35, 4, 6, 26, 10, 24, 29]), bench: [POOL[23], POOL[30]] }, theirs: { starters: pick([18, 19, 5, 27, 22, 31, 32, 33, 34, 30]), bench: [POOL[12]] } },
  30: { mine: { starters: pick([17, 36, 15, 38, 20, 9, 25, 28, 31, 33]), bench: [POOL[37], POOL[21]] }, theirs: { starters: pick([0, 3, 1, 7, 4, 6, 8, 30, 32, 34]), bench: [POOL[13], POOL[24]] } },
};

const AUTOMATION = { autopilot: false, dime: false, lineup: "act", daily_actions: "notify", lanes: "act", late_scratch: "notify" } as const;

interface Spec {
  id: number;
  name: string;
  league: string;
  state: TeamOverview["state"];
  opp: string;
  score: [number, number];
  proj: [number, number];
  win: number | null;
  season: [number, number, number, number, number | null] | null;
  week: OverviewDay[];
  items: OverviewItem[];
  next: TeamOverview["next"];
  categories?: [number, number, number];
  automation?: Partial<NonNullable<TeamOverview["automation"]>>;
}

function team(s: Spec): TeamOverview {
  const cats = s.categories;
  const tonight = tonightOf(SIDES[s.id].mine);
  // Today's line of the week is tonight's two lineups so far, as it is on the server
  const theirs = SIDES[s.id].theirs.starters.reduce((a, p) => a + (p ? (rosterPlayer("UT", p).live?.live_fpts ?? 0) : 0), 0);
  const week = cats ? s.week : s.week.map((d) => (d.kind === "today" ? { ...d, your_points: tonight.points ?? 0, opponent_points: theirs } : d));
  return {
    team_id: s.id,
    team_name: s.name,
    league_name: s.league,
    provider: "espn",
    scoring_format: cats ? "categories" : "points",
    state: s.state,
    error: null,
    items: s.items,
    automation: { ...AUTOMATION, ...s.automation },
    tonight,
    matchup: {
      matchup_period: 5,
      start: "2026-11-16",
      end: "2026-11-22",
      opponent_name: s.opp,
      your_score: s.score[0],
      opponent_score: s.score[1],
      your_projected: s.proj[0],
      opponent_projected: s.proj[1],
      scoring_format: cats ? "categories" : "points",
      categories: cats ? { wins: cats[0], losses: cats[1], ties: cats[2] } : null,
      win_chance: s.win,
    },
    week,
    season: s.season ? { wins: s.season[0], losses: s.season[1], ties: 0, standing: s.season[2], teams: s.season[3], playoff_teams: 4, playoff_odds: s.season[4], as_of: at("19:20") } : null,
    season_state: s.season && !cats ? "ready" : "unavailable",
    next: s.next,
    nba_date: HOME_DEMO_DATE,
    roster_version: "demo",
    scoring_period_id: 31,
    can_write: true,
    write_blocked_reason: null,
    missing: [],
  };
}

const TEAMS: TeamOverview[] = [
  team({
    id: 25, name: "Paint Beasts", league: "The Sunday Run · 10 teams", state: "needs_you", opp: "Splash Dept.",
    score: [596.5, 641], proj: [1339, 1328], win: 0.54, season: [4, 0, 1, 10, 0.81],
    week: weekOf([[214, 230], [188, 186], [153, 187]], [41.5, 38], [[5, 8], [9, 6], [8, 5]]),
    items: [
      item("needs_you", action("scratch", "scratch-irving", "Irving is out. Start Clingan in his place.", "Clingan to UT, Maxey to G, Irving to the bench", IRVING, "G", "20:00"), "20:00"),
      item("your_call", action("add_drop", "stream-1", "Stream Sensabaugh for VanVleet.", "Four games left this week against VanVleet's two", ["Brice Sensabaugh", "UTA"], "BE", null)),
    ],
    next: { kind: "lane", at: at("03:02", "2026-11-20"), label: "Stream lane keeps Wiggins through Friday" },
  }),
  team({
    id: 21, name: "Nine Lives", league: "Office Cats League", state: "your_call", opp: "Board Men",
    score: [3, 5], proj: [4, 5], win: 0.41, season: [2, 2, 5, 8, null], categories: [3, 5, 0],
    week: weekOf([[4, 4], [3, 5], [3, 5]], [3, 5], [[4, 6], [7, 7], [6, 4]], true),
    items: [item("your_call", action("ir_in", "ir-harris", "Harris is out and IR has an open seat.", "T. Harris moves to IR, which frees a roster spot", HARRIS, "BE", null))],
    next: { kind: "auto_lineup", at: at("18:15", "2026-11-20"), label: "Auto-lineup sets the lineup" },
  }),
  team({
    id: 23, name: "Glass Cleaners", league: "Rec Center Run · 8 teams", state: "set", opp: "Dunk Dynasty",
    score: [612.5, 588], proj: [1285, 1189], win: 0.78, season: [2, 2, 4, 8, 0.99],
    week: weekOf([[190, 202], [221, 195], [162, 158]], [39, 34], [[7, 6], [8, 8], [9, 7]]),
    items: [],
    next: { kind: "lane", at: at("03:02", "2026-11-21"), label: "Lane switch: Lopez for Kessler" },
  }),
  team({
    id: 24, name: "Bank Shots", league: "Family League · 4 teams", state: "set", opp: "Uncle Drop Step",
    score: [471.5, 668], proj: [1033, 1279], win: 0.01, season: [1, 3, 4, 4, 0.12],
    week: weekOf([[171, 225], [146, 198], [124, 193]], [32, 52.5], [[5, 6], [7, 9], [6, 7]]),
    items: [],
    next: { kind: "auto_lineup", at: at("18:15", "2026-11-20"), label: "Auto-lineup sets the lineup" },
  }),
  team({
    id: 30, name: "Set and Forget", league: "Beginner H2H · 10 teams", state: "autopilot", opp: "Net Profits",
    score: [655, 512.5], proj: [1362, 1023], win: 0.98, season: [3, 1, 2, 10, 0.96],
    week: weekOf([[201, 163], [220, 188], [192, 128]], [42, 33], [[6, 7], [8, 6], [8, 8]]),
    items: [],
    next: { kind: "checkin", at: at("06:00", "2026-11-20"), label: "Morning check-in" },
    automation: { autopilot: true, dime: true, lineup: "ai", daily_actions: "ai", lanes: "ai", late_scratch: "ai" },
  }),
];

export const HOME_DEMO: TeamsOverviewData = {
  as_of: new Date(HOME_DEMO_NOW).toISOString(),
  counts: { needs_you: 1, your_call: 1, set: 2, autopilot: 1, cant_read: 0 },
  next_deadline_at: at("20:00"),
  teams: TEAMS,
};

/** Tonight's two rosters for one demo team, as the live matchup read returns them. */
export function demoLiveMatchup(teamId: number | null): LiveMatchupData | null {
  const t = TEAMS.find((x) => x.team_id === teamId);
  const sides = teamId != null ? SIDES[teamId] : undefined;
  if (!t || !sides) return null;
  return liveOf(t.team_id, t.team_name, sides.mine, t.matchup!.opponent_name, sides.theirs);
}

/** Dime's last check-in on the demo's autopilot team. */
export const HOME_DEMO_CHECKINS = new Map<number, { title: string; conversationId: number | null; at: string }>([
  [30, { title: "Started Hartenstein for Antetokounmpo, who is out.", conversationId: null, at: at("18:10") }],
]);
