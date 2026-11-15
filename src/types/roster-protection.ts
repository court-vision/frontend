/**
 * Protected players on a team (`/v1/internal/teams/{id}/protections`; the roster
 * lock). A protected player is never dropped, or suggested as a drop, by Court
 * Vision (the Week desk, scheduled pickups, stream lanes, Dime) until the user
 * unprotects him. Protecting cancels what would drop him: the answer names what
 * it cancelled, and what was already being sent. Shims over the generated schemas.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type ProtectedPlayer = S["ProtectedPlayer"];
export type ProtectionCancelled = S["ProtectionCancelled"];
export type RosterProtections = S["RosterProtectionsData"];
export type RosterProtectionsResponse = S["RosterProtectionsResp"];
