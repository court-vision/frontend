/**
 * Daily Actions widget types — shims over the generated OpenAPI schemas
 * (`bun run generate:api`) for `GET /teams/{id}/actions`.
 *
 * A row's `moves` are the editor's own `LineupMoveResult`s (moves[0] is the
 * subject's move), so a lineup row stages straight into the lineup editor; an
 * add / add_drop row carries the `StreamerPlayerResp` the add/drop dialog takes
 * plus the id of the player to release. `lineup` is the board every row was
 * computed against.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type DailyAction = S["DailyAction"];
export type DailyActionKind = DailyAction["kind"];
export type DailyActionBlockedReason = NonNullable<DailyAction["blocked_reason"]>;
export type DailyActionPlayer = S["DailyActionPlayer"];
export type DailyActionTransaction = S["DailyActionTransaction"];
export type DailyActionsData = S["DailyActionsData"];
export type DailyActionsResponse = S["DailyActionsResp"];
