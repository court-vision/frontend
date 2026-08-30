/**
 * Lineup-generation & schedule types — generated from the backend's OpenAPI
 * schema. Shim over `src/types/generated/api.ts`; regenerate with `bun run
 * generate:api`.
 *
 * Two hand-written fictions died in the codegen switch:
 * - `SaveLineupResponse.already_exists` never existed server-side (the route's
 *   response_model strips it) — the duplicate signal is
 *   `error_code === "LINEUP_ALREADY_EXISTS"` on an error envelope.
 * - `Lineup.value_kind` was declared "the response does not carry this yet";
 *   it still doesn't, so the UI's fallback to the team's scoring format is the
 *   only path and no longer pretends otherwise.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type SlimPlayer = S["SlimPlayer"];
export type SlimGene = S["SlimGene-Output"];

export type Lineup = S["LineupInfo-Output"];

export type LineupGenerationRequest = S["GenerateLineupReq"];

export type ScheduleWeek = S["ScheduleWeek"];

/** The active season as the server calendar sees it (`GET /schedule/weeks` → `season`). */
export type SeasonInfo = S["SeasonInfo"];

export type ScheduleWeeksData = S["ScheduleWeeksData"];

export type LineupSaveRequest = S["SaveLineupReq"];

// Backend API Response Types
export type ScheduleWeeksResponse = S["ScheduleWeeksResp"];
export type GenerateLineupResponse = S["GenerateLineupResp"];
export type GetLineupsResponse = S["GetLineupsResp"];
export type SaveLineupResponse = S["SaveLineupResp"];
export type DeleteLineupResponse = S["DeleteLineupResp"];
