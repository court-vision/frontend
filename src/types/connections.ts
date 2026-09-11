/**
 * Provider connections — generated from the backend's OpenAPI schema.
 *
 * Shim over `src/types/generated/api.ts`; regenerate with `bun run
 * generate:api`.
 *
 * A connection is one provider account's stored credentials, shared by every
 * team on that account — for ESPN, one espn_s2/SWID pair per ESPN account. The
 * API never returns the credentials; `account_hint` is the last four
 * characters of the account id, enough to tell two accounts apart.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type ProviderConnection = S["ProviderConnectionInfo"];
export type ConnectionStatus = ProviderConnection["status"];
export type ConnectionTeam = S["ConnectionTeamInfo"];
/** A team on a connected ESPN account as ESPN lists it; `tracked_team_id`
 *  is set when Court Vision already has it. */
export type EspnAccountTeam = S["EspnAccountTeam"];
export type EspnConnectRequest = S["EspnConnectReq"];

export type ProviderConnectionListResponse = S["ProviderConnectionListResp"];
export type ProviderConnectionResponse = S["ProviderConnectionResp"];
export type ProviderConnectionDeleteResponse = S["ProviderConnectionDeleteResp"];
export type EspnAccountTeamsResponse = S["EspnAccountTeamsResp"];
