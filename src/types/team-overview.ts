/**
 * Every team in the account in one read (`GET /teams/overview`): shims over the
 * generated OpenAPI schemas (`bun run generate:api`). The Home desk's whole model.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type TeamsOverviewData = S["TeamsOverviewData"];
export type TeamsOverviewResponse = S["TeamsOverviewResp"];
export type TeamOverview = S["TeamOverview"];
export type TeamState = TeamOverview["state"];
export type OverviewItem = S["OverviewItem"];
export type ItemStanding = OverviewItem["standing"];
export type CoveredBy = NonNullable<OverviewItem["covered_by"]>;
export type OverviewAutomation = S["OverviewAutomation"];
export type AutomationLevel = OverviewAutomation["lineup"];
export type OverviewTonight = S["OverviewTonight"];
export type OverviewSeat = S["OverviewSeat"];
export type SeatMark = OverviewSeat["mark"];
export type OverviewMatchup = S["OverviewMatchup"];
export type OverviewDay = S["OverviewDay"];
export type OverviewSeason = S["OverviewSeason"];
export type OverviewNext = S["OverviewNext"];
