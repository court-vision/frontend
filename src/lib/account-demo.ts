/**
 * The Account desk's demo: a made-up account with three teams on two
 * providers, an ESPN account that lists two more teams than are tracked, a
 * Yahoo account nobody has checked, and lineup alerts half set up. Every
 * write lands in memory. Nothing here is real.
 */
import type { AiActing, AiAutomationName, AiAutopilotChange, AiAutopilotTeam, AiFeatures, AiLevel } from "@/types/ai";
import type { EspnAccountTeam, ProviderConnection } from "@/types/connections";
import type { NotificationPreference, NotificationTeamPreference } from "@/types/notifications";
import type { LeagueDetail, LeagueSummary, TeamResponseData } from "@/types/team";
import type { YahooLeague, YahooTeam } from "@/types/yahoo";
import type { Capabilities } from "./account";
import { AI_ROWS, ROW_LABEL, LEVEL_LABEL, lineupLevel, lineupPrefs, offersAi, tableOf } from "./ai-autonomy";

export const DEMO_NOW = Date.parse("2026-10-09T15:00:00Z");
const h = (hours: number) => new Date(DEMO_NOW - hours * 3600_000).toISOString();

const ESPN_CAPS: Capabilities = {
  account_teams: true,
  daily_lineups: true,
  draft_import: true,
  draft_sync: true,
  lineup_read: true,
  lineup_write: true,
  live_totals: false,
  position_limits: true,
  transactions: true,
  waiver_claims: false,
  write_scope: true,
};

const YAHOO_CAPS: Capabilities = {
  account_teams: true,
  daily_lineups: true,
  draft_import: false,
  draft_sync: false,
  lineup_read: true,
  lineup_write: false,
  live_totals: true,
  position_limits: false,
  transactions: false,
  waiver_claims: false,
  write_scope: false,
};

const NINE_CAT: LeagueSummary["categories"] = [
  { key: "fg_pct", label: "FG%", higher_is_better: true, is_rate: true },
  { key: "ft_pct", label: "FT%", higher_is_better: true, is_rate: true },
  { key: "fg3m", label: "3PM", higher_is_better: true, is_rate: false },
  { key: "pts", label: "PTS", higher_is_better: true, is_rate: false },
  { key: "reb", label: "REB", higher_is_better: true, is_rate: false },
  { key: "ast", label: "AST", higher_is_better: true, is_rate: false },
  { key: "stl", label: "STL", higher_is_better: true, is_rate: false },
  { key: "blk", label: "BLK", higher_is_better: true, is_rate: false },
  { key: "tov", label: "TO", higher_is_better: false, is_rate: false },
];

const POINT_WEIGHTS = { pts: 1, reb: 1, ast: 2, stl: 4, blk: 4, tov: -2, fg3m: 1, fgm: 2, fga: -1, ftm: 1, fta: -1 };

const GOBLINS: LeagueSummary = {
  id: 1,
  provider: "espn",
  provider_league_id: "993431466",
  season: 2027,
  name: "Lvl. 3 Goblins",
  scoring_type: "points",
  category_win_mode: null,
  categories: [],
  point_weights: POINT_WEIGHTS,
  settings_synced: true,
  settings_synced_at: h(30),
  scoring_preview: null,
};

const CATS: LeagueSummary = {
  id: 2,
  provider: "espn",
  provider_league_id: "1180204011",
  season: 2027,
  name: "Hardwood Nine",
  scoring_type: "categories",
  category_win_mode: "each_category",
  categories: NINE_CAT,
  point_weights: {},
  settings_synced: true,
  settings_synced_at: h(54),
  scoring_preview: null,
};

export const DEMO_TEAMS: TeamResponseData[] = [
  {
    team_id: 1,
    league_info: {
      provider: "espn",
      league_id: 993431466,
      team_name: "Paint Beasts",
      league_name: "Lvl. 3 Goblins",
      year: 2027,
      yahoo_team_key: null,
      espn_team_id: 4,
      scoring_preview: null,
      has_espn_credentials: true,
      has_yahoo_credentials: false,
    },
    league: GOBLINS,
    capabilities: ESPN_CAPS,
  },
  {
    team_id: 2,
    league_info: {
      provider: "espn",
      league_id: 1180204011,
      team_name: "Corner Three Co.",
      league_name: "Hardwood Nine",
      year: 2027,
      yahoo_team_key: null,
      espn_team_id: 7,
      scoring_preview: null,
      has_espn_credentials: true,
      has_yahoo_credentials: false,
    },
    league: CATS,
    capabilities: ESPN_CAPS,
  },
  {
    team_id: 3,
    league_info: {
      provider: "yahoo",
      league_id: 41822,
      team_name: "Night Shift",
      league_name: "Office Pub League",
      year: 2026,
      yahoo_team_key: "466.l.41822.t.6",
      espn_team_id: null,
      scoring_preview: null,
      has_espn_credentials: false,
      has_yahoo_credentials: true,
    },
    league: null,
    capabilities: YAHOO_CAPS,
  },
];

export const DEMO_CONNECTIONS: ProviderConnection[] = [
  {
    id: 1,
    provider: "espn",
    account_hint: "…E5F6",
    status: "ok",
    verified_at: h(20),
    auth_failed_at: null,
    created_at: h(24 * 40),
    updated_at: h(20),
    teams: [
      { team_id: 1, team_name: "Paint Beasts", league_name: "Lvl. 3 Goblins", league_id: 993431466, year: 2027 },
      { team_id: 2, team_name: "Corner Three Co.", league_name: "Hardwood Nine", league_id: 1180204011, year: 2027 },
    ],
  },
  {
    id: 2,
    provider: "yahoo",
    account_hint: null,
    status: "unknown",
    verified_at: null,
    auth_failed_at: null,
    created_at: h(24 * 12),
    updated_at: h(24 * 12),
    teams: [{ team_id: 3, team_name: "Night Shift", league_name: "Office Pub League", league_id: 41822, year: 2026 }],
  },
];

/** What ESPN lists on the connected account: the two tracked teams, a renewal and an old season. */
export const DEMO_ACCOUNT_TEAMS: EspnAccountTeam[] = [
  { espn_team_id: 4, league_id: 993431466, league_name: "Lvl. 3 Goblins", league_size: 12, scoring_type: "H2H_POINTS", season: 2027, team_abbrev: "PB", team_name: "Paint Beasts", tracked_team_id: 1, previous_season_team_id: null },
  { espn_team_id: 7, league_id: 1180204011, league_name: "Hardwood Nine", league_size: 10, scoring_type: "H2H_CATEGORY", season: 2027, team_abbrev: "C3", team_name: "Corner Three Co.", tracked_team_id: 2, previous_season_team_id: null },
  { espn_team_id: 2, league_id: 2048811, league_name: "Sunday Dynasty", league_size: 14, scoring_type: "H2H_CATEGORY", season: 2027, team_abbrev: "SD", team_name: "Sixth Man Syndicate", tracked_team_id: null, previous_season_team_id: null },
  { espn_team_id: 9, league_id: 77120, league_name: "Public Lobby 77120", league_size: 10, scoring_type: "H2H_POINTS", season: 2027, team_abbrev: "FB", team_name: "Free Throw Line", tracked_team_id: null, previous_season_team_id: null },
  { espn_team_id: 4, league_id: 993431466, league_name: "Lvl. 3 Goblins", league_size: 12, scoring_type: "H2H_POINTS", season: 2026, team_abbrev: "PB", team_name: "Paint Beasts", tracked_team_id: null, previous_season_team_id: null },
];

export const DEMO_YAHOO_LEAGUES: YahooLeague[] = [
  { league_key: "466.l.41822", league_id: "41822", name: "Office Pub League", season: "2026", num_teams: 12, scoring_type: "head" },
  { league_key: "466.l.90210", league_id: "90210", name: "Cousins Only", season: "2026", num_teams: 8, scoring_type: "headpoint" },
];

export const DEMO_YAHOO_TEAMS: Record<string, YahooTeam[]> = {
  "466.l.41822": [
    { team_key: "466.l.41822.t.1", team_id: "1", name: "Dunk Tank", is_owned_by_current_login: false },
    { team_key: "466.l.41822.t.6", team_id: "6", name: "Night Shift", is_owned_by_current_login: true },
    { team_key: "466.l.41822.t.9", team_id: "9", name: "Pick and Pop", is_owned_by_current_login: false },
  ],
  "466.l.90210": [
    { team_key: "466.l.90210.t.2", team_id: "2", name: "Aunt Rita's Revenge", is_owned_by_current_login: true },
    { team_key: "466.l.90210.t.3", team_id: "3", name: "The In-Laws", is_owned_by_current_login: false },
  ],
};

export function demoLeagueDetail(teamId: number, teams: readonly TeamResponseData[] = DEMO_TEAMS): LeagueDetail | null {
  const team = teams.find((t) => t.team_id === teamId);
  if (!team?.league) return null;
  const l = team.league;
  const nine = l.scoring_type === "categories";
  return {
    ...l,
    draft_settings: { type: "snake", rounds: 13 },
    matchup_periods: { period_count: 19, period_length: 1, start_week: 1, end_week: 19, playoff_start_week: 20, playoff_team_count: nine ? 4 : 6, playoff_period_length: 1 },
    position_limits: nine ? {} : { C: 4 },
    roster_slots: { PG: 1, SG: 1, SF: 1, PF: 1, C: 1, G: 1, F: 1, UTIL: 3, BE: 3, IR: 1 },
    unsupported: nine ? [] : ["dq", "ejct"],
    warnings: nine ? ["ESPN counts the turnovers category as lower-is-better; the league page agrees."] : [],
  };
}

export const DEMO_PREFS: NotificationPreference = {
  lineup_alerts_enabled: true,
  alert_benched_starters: true,
  alert_active_non_playing: true,
  alert_injured_active: true,
  alert_minutes_before: 90,
  auto_lineup_enabled: false,
  email: null,
};

export const DEMO_TEAM_PREFS: NotificationTeamPreference[] = [
  { team_id: 1, has_override: false, lineup_alerts_enabled: null, alert_benched_starters: null, alert_active_non_playing: null, alert_injured_active: null, alert_minutes_before: null, auto_lineup_enabled: null, email: null },
  { team_id: 2, has_override: true, lineup_alerts_enabled: true, alert_benched_starters: null, alert_active_non_playing: null, alert_injured_active: null, alert_minutes_before: 45, auto_lineup_enabled: true, email: null },
  { team_id: 3, has_override: false, lineup_alerts_enabled: null, alert_benched_starters: null, alert_active_non_playing: null, alert_injured_active: null, alert_minutes_before: null, auto_lineup_enabled: null, email: null },
];

export const DEMO_USER = { name: "Demo Manager", email: "demo@courtvision.dev", imageUrl: null as string | null };

// ---- Dime: one team it runs on, every change kept in memory

/** The server's switches and policy, as a server with acting on would send them. */
export const DEMO_ACTING: AiActing = {
  available: true,
  steering: true,
  writes: true,
  policy: { adds_per_day: 2, adds_per_matchup: 5, adds_reserve: 1, protected_top: 6, churn_hours: 48, pause_refused: 2, pause_same_block: 2 },
};

export const DEMO_FEATURES: AiFeatures = { memory: true, draft_rooms: true };

type LineupOverride = { lineup_alerts_enabled: boolean | null; auto_lineup_enabled: boolean | null };

/** What usr.autopilot holds for a demo team. */
export interface DemoDime {
  team_id: number;
  ai_rows: AiAutomationName[];
  autopilot: boolean;
  paused_at: string | null;
  paused_by: "user" | "system" | null;
  active_since: string;
  /** What the autopilot switch changed when it came on: the team's lineup override, whether check-ins were on. */
  restore: { lineup: LineupOverride; checkins_on: boolean } | null;
}

/** The demo's first team: daily actions at AI, check-ins on. */
export function demoDime(now: number = Date.now()): DemoDime[] {
  return [
    {
      team_id: DEMO_TEAMS[0].team_id,
      ai_rows: ["daily_actions"],
      autopilot: false,
      paused_at: null,
      paused_by: null,
      active_since: new Date(now - 7 * 86_400_000).toISOString(),
      restore: null,
    },
  ];
}

/** The team as GET /ai/checkins would send it, its lineup row read from the demo's preferences. */
export function demoDimeTeam(
  d: DemoDime,
  prefs: NotificationPreference,
  override: NotificationTeamPreference | undefined,
  now: number = Date.now()
): AiAutopilotTeam {
  const date = new Date(now + 86_400_000).toISOString().slice(0, 10);
  const on = d.paused_at == null;
  const pick = <K extends keyof LineupOverride>(k: K) => override?.[k] ?? prefs[k];
  return {
    team_id: d.team_id,
    on,
    active_since: d.active_since,
    paused_at: d.paused_at,
    paused_by: d.paused_by,
    paused_reason: null,
    next: on ? { kind: "morning", date, due_at: `${date}T14:00:00Z` } : null,
    autopilot: d.autopilot,
    rows: tableOf({
      aiRows: d.ai_rows,
      autopilot: d.autopilot,
      paused: !on,
      pausedBy: d.paused_by,
      lineupBelowAi: prefs.lineup_alerts_enabled
        ? lineupLevel({ lineup_alerts_enabled: !!pick("lineup_alerts_enabled"), auto_lineup_enabled: !!pick("auto_lineup_enabled") })
        : "off",
      lineupEmail: prefs.lineup_alerts_enabled,
      actingAvailable: DEMO_ACTING.available,
    }),
  };
}

/**
 * A change to a demo team, as the server would make it (services/ai/levels.py): the new row,
 * and the lineup override to write when the change touches it. Throws the server's refusal for a
 * level the row doesn't offer.
 */
export function demoDimeChange(
  d: DemoDime,
  team: AiAutopilotTeam,
  override: LineupOverride,
  change: AiAutopilotChange,
  now: number = Date.now()
): { dime: DemoDime; lineup: LineupOverride | null } {
  const levels = Object.entries(change.levels ?? {}) as Array<[AiAutomationName, AiLevel]>;
  for (const [row, level] of levels) {
    const option = team.rows.find((r) => r.row === row)?.options.find((o) => o.level === level);
    if (option && !option.available) throw new Error(`${ROW_LABEL[row]} can't be ${LEVEL_LABEL[level]}: ${option.reason}`);
  }
  let rows = new Set(d.ai_rows);
  let autopilot = d.autopilot;
  let restore = d.restore;
  let checkins = change.checkins;
  let lineup: LineupOverride | null = null;
  const fill = lineupPrefs("ai");
  if (change.autopilot === true && !autopilot) {
    restore = { lineup: override, checkins_on: d.paused_at == null };
    autopilot = true;
    lineup = fill;
    checkins = true;
  } else if (change.autopilot === false && autopilot) {
    autopilot = false;
    if (restore) {
      const unchanged = override.lineup_alerts_enabled === fill.lineup_alerts_enabled && override.auto_lineup_enabled === fill.auto_lineup_enabled;
      if (!rows.has("lineup") && unchanged) lineup = restore.lineup;
      if (!restore.checkins_on && rows.size === 0 && checkins == null) checkins = false;
    }
    restore = null;
  }
  if (levels.length) {
    if (autopilot) {
      rows = new Set(AI_ROWS.filter(offersAi));
      autopilot = false;
      restore = null;
    }
    for (const [row, level] of levels) {
      if (row === "checkins") {
        checkins = level === "ai";
        continue;
      }
      if (level === "ai") {
        rows.add(row);
        checkins = checkins ?? true;
      } else rows.delete(row);
      if (row === "lineup") lineup = lineupPrefs(level);
    }
  }
  let pause = { paused_at: d.paused_at, paused_by: d.paused_by, active_since: d.active_since };
  if (checkins === true && d.paused_at != null) pause = { paused_at: null, paused_by: null, active_since: new Date(now).toISOString() };
  else if (checkins === false && d.paused_at == null) pause = { ...pause, paused_at: new Date(now).toISOString(), paused_by: "user" };
  return { dime: { ...d, ...pause, ai_rows: AI_ROWS.filter((r) => rows.has(r)), autopilot, restore }, lineup };
}
