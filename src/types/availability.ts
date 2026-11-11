/**
 * Our availability verdicts (`GET /teams/{id}/availability`): shims over the
 * generated OpenAPI schemas (`bun run generate:api`). One verdict per player
 * per game date, by NBA id, from data-platform's availability pipeline.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type Verdict = S["Verdict"];
export type VerdictWord = Verdict["verdict"];
export type TeamAvailabilityData = S["TeamAvailabilityData"];
export type TeamAvailabilityResponse = S["TeamAvailabilityResp"];
