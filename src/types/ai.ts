/**
 * The AI desk (`/v1/internal/ai/*`, docs/AI_AGENT_PLAN.md) — shims over the
 * generated OpenAPI schemas (`bun run generate:api`).
 *
 * A conversation is a list of turns; each turn's answer is `parts`: prose,
 * tables and charts in the order the user saw them. Tables and charts are
 * built by the server from the agent's lookups, never typed by the model.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type AiUsage = S["AiUsageData"];
export type AiUsageResponse = S["AiUsageResp"];
export type AiConversationSummary = S["AiConversationSummary"];
export type AiConversation = S["AiConversationDetail"];
export type AiConversationResponse = S["AiConversationResp"];
export type AiConversationListResponse = S["AiConversationListResp"];
export type AiTurn = S["AiTurnView"];
export type AiTable = S["AiTable"];
export type AiChart = S["AiChart"];
export type AiChartSeries = S["AiChartSeries"];
/** What a block part carries: a table or a chart. */
export type AiBlock = AiTable | AiChart;
export type AiPart = S["AiTextPart"] | S["AiBlockPart"];
export type AiTurnFeedbackResponse = S["AiTurnFeedbackResp"];
export type AiTurnCommentResponse = S["AiTurnCommentResp"];
export type AiFeedback = "up" | "down";
