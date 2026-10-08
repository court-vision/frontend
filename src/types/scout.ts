/**
 * The Scout desk's wire types: the public player directory (search), the
 * profile snapshot, trends, the ESPN preseason projection and the ESPN
 * draft market. Shims over the generated OpenAPI schema; regenerate with
 * `bun run generate:api`.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type PlayerSearchItem = S["PlayerSearchItem"];
export type PlayerSearchData = S["PlayerSearchData"];
export type PlayerProfileData = S["PlayerProfileData"];
export type PlayerProfileDetails = S["PlayerProfileDetails"];
export type PlayerTrendsData = S["PlayerTrendsData"];
export type TrendPeriod = S["TrendPeriod"];
export type PlayerProjectionData = S["PlayerProjectionData"];
export type ProjectionStats = S["ProjectionStats"];
export type ESPNMarketPlayer = S["ESPNMarketPlayer"];
export type ESPNMarketData = S["ESPNMarketData"];
export type ESPNMarketMovementPlayer = S["ESPNMarketMovementPlayer"];
export type ESPNMarketMovementData = S["ESPNMarketMovementData"];

/** The ESPN market's sort keys and the movement endpoint's direction, as the API spells them. */
export type MarketSort = "rank" | "adp" | "auction_value" | "auction_value_avg";
export type MarketDirection = "up" | "down" | "both";
