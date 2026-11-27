/**
 * The Team desk's three reads, all for one ESPN points team (shims over the generated OpenAPI
 * schemas, `bun run generate:api`):
 * - `GET /teams/{id}/league/projections`: every roster in the league projected the same way,
 *   the league's benchmarks per matchup, playoff odds.
 * - `GET /teams/{id}/league/values?window=`: every rostered player (and the best free agents)
 *   priced over a window of matchups, and each roster's tiers against the league's.
 * - `GET /teams/{id}/league/streaming-line?window=`: the points per game of the free agents
 *   optimal streaming picks up, and each of your players against it (up to four matchups).
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type LeagueProjectionData = S["LeagueProjectionData"];
export type LeagueProjectionResponse = S["LeagueProjectionResp"];
export type Benchmark = S["Benchmark"];
export type MatchupBenchmark = S["MatchupBenchmark"];
export type TeamProjection = S["TeamProjection"];

export type LeagueValuesData = S["LeagueValuesData"];
export type LeagueValuesResponse = S["LeagueValuesResp"];
export type ValueWindow = S["ValueWindow"];
export type PlayerWindowValue = S["PlayerWindowValue"];
export type TierBenchmark = S["TierBenchmark"];

export type StreamingLineData = S["StreamingLineData"];
export type StreamingLineResponse = S["StreamingLineResp"];
export type MatchupStreamingLine = S["MatchupStreamingLine"];
export type LinePlayerValue = S["LinePlayerValue"];

/** The preset windows both priced reads take. */
export type ValueWindowKey = NonNullable<StreamingLineData["key"]>;
