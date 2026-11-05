/**
 * Dime's holds on a team (`/v1/internal/teams/{id}/holds`; the Dime autopilot
 * plan, step 4): one player over a run of days, with what it does and Dime's
 * reason, read by Court Vision's own automations (auto-lineup's fill, the stream
 * lanes) through its last day. Made by applying a steer chip from the AI desk;
 * the Week desk lists them and clears any. Shims over the generated schemas.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type TeamHold = S["TeamHold"];
export type TeamHoldKind = TeamHold["kind"];
export type TeamHolds = S["TeamHoldsData"];
export type TeamHoldsResponse = S["TeamHoldsResp"];
