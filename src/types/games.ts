/**
 * NBA game/schedule types — generated from the backend's OpenAPI schema.
 *
 * Shim over `src/types/generated/api.ts`; regenerate with `bun run
 * generate:api`.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type GameInfo = S["GameInfo"];
export type GamesOnDateData = S["GamesOnDateData"];
export type ScheduleGame = S["ScheduleGame"];
export type TeamScheduleData = S["TeamScheduleData"];
export type TopPerformer = S["TopPerformer"];
export type InjuredPlayer = S["InjuredPlayer"];
export type GameScoreSnapshot = S["GameScoreSnapshot"];
export type NBATeamLiveGameData = S["NBATeamLiveGameData"];
