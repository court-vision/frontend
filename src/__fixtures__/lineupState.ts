/**
 * Dev-only fixture: today's ESPN lineup for a 13-player roster (PG SG SF PF C
 * G F, 3 UT, 3 BE, 1 IR — one bench spot open), used by
 * `/your-teams?mock=lineup` (non-production builds only) to exercise the
 * editor without a backend. It has the situations the editor must handle:
 * a locked starter (game started), a starter with no game, an OUT starter
 * with a game, a DTD starter, two bench players with games, and an IR player.
 *
 * `MOCK_LINEUP_PLAN` is what the server's fill-only planner would answer for
 * this board: the healthy bench players start, the no-game and OUT starters
 * sit. `applyStagedLocally` fakes the write so the confirm flow can be walked.
 */
import type {
  LineupMoveResult,
  LineupPlanData,
  LineupPlayer,
  LineupState,
} from "@/types/lineup-editor";
import { SLOT_NAMES, moveRole, type Staged } from "@/lib/lineup-editor";

const PG = 0, SG = 1, SF = 2, PF = 3, C = 4, G = 5, F = 6, UT = 11, BE = 12, IR = 13;

function player(
  id: number,
  nbaId: number,
  name: string,
  team: string,
  slot: number,
  eligible: number[],
  avg: number,
  extra: Partial<LineupPlayer> = {}
): LineupPlayer {
  const hasGame = extra.has_game_today ?? extra.opponent != null;
  const injury = extra.injury_status ?? null;
  const upper = injury?.toUpperCase() ?? null;
  // Two different questions, as on the server: availability (OUT_STATUSES) decides
  // `playable`, while injury (IR_STATUSES — no SUSPENSION) decides whether ESPN will
  // accept an IR move. A status alone never means injured; ESPN sends its own flag.
  const isOut = upper != null && ["OUT", "O", "IL", "IL+", "SUSPENSION", "INJURY_RESERVE"].includes(upper);
  const isInjured = upper != null && ["OUT", "O", "IL", "IL+", "INJURY_RESERVE"].includes(upper);
  const gameStarted = extra.game_started ?? false;
  const lineupLocked = extra.lineup_locked ?? false;
  return {
    player_id: id,
    nba_player_id: nbaId,
    name,
    team,
    lineup_slot_id: slot,
    lineup_slot: SLOT_NAMES[slot],
    eligible_slot_ids: eligible,
    eligible_slots: eligible.map((s) => SLOT_NAMES[s]),
    injured: extra.injured ?? isInjured,
    injury_status: injury,
    default_position_id: extra.default_position_id ?? null,
    lineup_locked: lineupLocked,
    has_game_today: hasGame,
    opponent: extra.opponent ?? null,
    game_time_et: extra.game_time_et ?? null,
    game_started: gameStarted,
    locked: lineupLocked || gameStarted,
    playable: hasGame && !isOut,
    avg_points: avg,
    value_kind: "fpts",
    value_source: "rolling",
  };
}

const PLAYERS: LineupPlayer[] = [
  player(4066648, 1630169, "Tyrese Haliburton", "IND", PG, [PG, G, UT, BE, IR], 44.1, {
    opponent: "vs MIL", game_time_et: "19:30",
  }),
  // The one started game: locked, cannot be moved or displaced.
  player(4432173, 1630217, "Desmond Bane", "ORL", SG, [SG, G, UT, BE], 34.4, {
    opponent: "@ ATL", game_time_et: "19:00", game_started: true,
  }),
  // Healthy starter with no game today — the obvious seat to give up.
  player(4395628, 1631114, "Jalen Williams", "OKC", SF, [SG, SF, G, F, UT, BE], 38.2),
  player(4432816, 1630596, "Evan Mobley", "CLE", PF, [PF, C, F, UT, BE], 37.9, {
    opponent: "vs BOS", game_time_et: "19:30",
  }),
  player(3112335, 203999, "Nikola Jokić", "DEN", C, [C, UT, BE], 66.3, {
    opponent: "@ LAL", game_time_et: "22:00",
  }),
  // DTD counts as healthy: ESPN still scores him if he plays.
  player(4278073, 1628404, "Josh Hart", "NYK", G, [PG, SG, G, UT, BE], 31.0, {
    opponent: "vs PHI", game_time_et: "19:30", injury_status: "DTD",
  }),
  player(4277961, 1628991, "Jaren Jackson Jr.", "MEM", F, [PF, C, F, UT, BE], 38.5, {
    opponent: "vs SAS", game_time_et: "20:00",
  }),
  player(4278104, 1630578, "Alperen Şengün", "HOU", UT, [C, UT, BE], 44.6, {
    opponent: "vs DAL", game_time_et: "20:30",
  }),
  // OUT with a game: kept unless a healthy bench player needs the seat.
  player(6450, 202695, "Kawhi Leonard", "LAC", UT, [SF, PF, F, UT, BE, IR], 40.2, {
    opponent: "vs UTA", game_time_et: "21:00", injury_status: "OUT",
  }),
  player(4869342, 1641705, "Scoot Henderson", "POR", UT, [PG, G, UT, BE], 26.8, {
    opponent: "vs SAC", game_time_et: "22:00",
  }),
  // Bench players with games — the fillers.
  player(4432639, 1630224, "Jalen Green", "PHX", BE, [SG, SF, G, F, UT, BE], 27.5, {
    opponent: "vs UTA", game_time_et: "21:00",
  }),
  player(4066261, 1628370, "Malik Monk", "SAC", BE, [SG, G, UT, BE], 24.9, {
    opponent: "@ POR", game_time_et: "22:00",
  }),
  // IR is never touched by the planner; his game is irrelevant.
  player(4279888, 1629630, "Ja Morant", "MEM", IR, [PG, G, UT, BE, IR], 41.0, {
    opponent: "vs SAS", game_time_et: "20:00", injury_status: "OUT",
  }),
];

export const MOCK_LINEUP_STATE: LineupState = {
  provider: "espn",
  team_name: "Nuggets of Wisdom",
  espn_team_id: 3,
  nba_date: "2026-10-20",
  scoring_period_id: 1,
  scoring_period_source: "provider",
  first_game_time_et: "19:00",
  slot_counts: {
    "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1,
    "7": 0, "8": 0, "9": 0, "10": 0, "11": 3, "12": 3, "13": 1,
  },
  position_limits: {},
  slots: [
    { slot_id: PG, slot: "PG", count: 1 },
    { slot_id: SG, slot: "SG", count: 1 },
    { slot_id: SF, slot: "SF", count: 1 },
    { slot_id: PF, slot: "PF", count: 1 },
    { slot_id: C, slot: "C", count: 1 },
    { slot_id: G, slot: "G", count: 1 },
    { slot_id: F, slot: "F", count: 1 },
    { slot_id: UT, slot: "UT", count: 3 },
    { slot_id: BE, slot: "BE", count: 3 },
    { slot_id: IR, slot: "IR", count: 1 },
  ],
  lock_type: "INDIVIDUAL_GAME",
  players: PLAYERS,
  can_write: true,
  write_blocked_reason: null,
  roster_version: "mock-1",
  fetched_at: "2026-10-20T22:30:00Z",
};

function planMove(
  id: number,
  from: number,
  to: number,
  note: string | null
): LineupMoveResult {
  const p = PLAYERS.find((x) => x.player_id === id)!;
  return {
    player_id: id,
    name: p.name,
    from_slot_id: from,
    from_slot: SLOT_NAMES[from],
    to_slot_id: to,
    to_slot: SLOT_NAMES[to],
    role: moveRole({ from_slot_id: from, to_slot_id: to }),
    note,
  };
}

export const MOCK_LINEUP_PLAN: LineupPlanData = {
  moves: [
    planMove(4432639, BE, SF, "vs UTA · 9:00 PM"),
    planMove(4395628, SF, BE, "no game today"),
    planMove(4066261, BE, UT, "@ POR · 10:00 PM"),
    planMove(6450, UT, BE, "OUT"),
  ],
  unfilled: [],
  summary:
    "4 move(s): start Jalen Green, start Malik Monk, bench Jalen Williams (no game today), bench Kawhi Leonard (OUT)",
  scoring_period_id: 1,
  nba_date: "2026-10-20",
  roster_version: "mock-1",
};

/** Everything `LineupEditorProvider` needs to run without a backend. */
export const MOCK_LINEUP_EDITOR = {
  state: MOCK_LINEUP_STATE,
  plan: MOCK_LINEUP_PLAN,
  apply: applyStagedLocally,
};

/** The board after the staged moves, as the server would re-read it (mock writes only). */
export function applyStagedLocally(state: LineupState, staged: Staged): LineupState {
  const version = Number(state.roster_version.split("-")[1] ?? "1") + 1;
  return {
    ...state,
    players: state.players.map((p) => {
      const to = staged[p.player_id];
      if (to === undefined) return p;
      return { ...p, lineup_slot_id: to, lineup_slot: SLOT_NAMES[to] ?? String(to) };
    }),
    roster_version: `mock-${version}`,
    fetched_at: new Date().toISOString(),
  };
}
