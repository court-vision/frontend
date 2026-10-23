/**
 * The AI desk (`/v1/internal/ai/*`, docs/AI_AGENT_PLAN.md) — shims over the
 * generated OpenAPI schemas (`bun run generate:api`).
 *
 * A conversation is a list of turns; each turn's answer is `parts`: prose,
 * tables, charts and chips in the order the user saw them. Tables and charts
 * are built by the server from the agent's lookups, never typed by the model.
 * A chip is a move the agent proposed and the server checked: an add / drop
 * (`propose_move`) or a day's slot moves (`propose_lineup`); it is staged into
 * the Week desk's tray, rendered in the AI desk, and sent by its slider through
 * the roster transaction / scheduled pickup / lineup write with `proposal_id`
 * on the request. Nothing is executed from the AI desk.
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
/** A proposed move as a block in a turn's parts (the chip, with its block id). */
export type AiProposal = S["AiProposal"];
/** The chip without its block id: what the proposal routes return. */
export type AiProposalChip = S["AiProposalChip"];
export type AiProposalPlayer = S["AiProposalPlayer"];
/** One slot move of a lineup chip, as the lineup write takes it and the tray shows it. */
export type AiProposalMove = S["AiProposalMove"];
export type AiProposalState = AiProposalChip["state"];
/** The chip as it stands plus why it can't be staged now (`problems` empty when it can). */
export type AiProposalCheck = S["AiProposalCheckData"];
export type AiProposalResponse = S["AiProposalResp"];
export type AiProposalDismissResponse = S["AiProposalDismissResp"];
/** What a block part carries: a table, a chart or a chip. */
export type AiBlock = AiTable | AiChart | AiProposal;
export type AiPart = S["AiTextPart"] | S["AiBlockPart"];
export type AiTurnFeedbackResponse = S["AiTurnFeedbackResp"];
export type AiTurnCommentResponse = S["AiTurnCommentResp"];
export type AiFeedback = "up" | "down";
