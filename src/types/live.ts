/**
 * Live game-data types — generated from the backend's OpenAPI schema.
 *
 * Shim over `src/types/generated/api.ts`; regenerate with `bun run
 * generate:api`. The hand-written predecessor of this file was missing
 * `ftm`/`fta`, which the wire has always carried.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type LivePlayerData = S["LivePlayerItem"];
export type LivePlayersData = S["LivePlayersData"];
export type LivePlayersResponse = S["LivePlayersResp"];
export type LiveScheduleData = S["LiveScheduleData"];
export type LiveScheduleResponse = S["LiveScheduleResp"];
export type ScoreboardGame = S["ScoreboardGameItem"];
export type ScoreboardData = S["ScoreboardData"];
export type ScoreboardResponse = S["ScoreboardResp"];
