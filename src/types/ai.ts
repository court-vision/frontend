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
export type AiProposalKind = AiProposalChip["kind"];
/**
 * Dime's steering chips (the Dime autopilot plan, step 4): `steer` sets and clears
 * holds, `lane` starts / pauses / resumes / stops a stream lane, `cancel_pickup`
 * cancels a pending pickup. They change no ESPN roster, so they never go in the
 * tray: the chip's Apply button calls the Week desk's own route for it with
 * `proposal_id` (lib/steering.ts).
 */
export type AiSteerAction = S["AiSteerAction"];
export type AiHoldChange = S["AiHoldChange"];
export type AiHoldCleared = S["AiHoldCleared"];
export type AiLaneAction = S["AiLaneAction"];
export type AiCancelPickupAction = S["AiCancelPickupAction"];
/** The chip as it stands plus why it can't be staged now (`problems` empty when it can). */
export type AiProposalCheck = S["AiProposalCheckData"];
export type AiProposalResponse = S["AiProposalResp"];
export type AiProposalDismissResponse = S["AiProposalDismissResp"];
export type AiPlace = S["AiPlace"];
/** One call a check-in logged (holds included), for the user to agree or disagree with. */
export type AiDecisionBlock = S["AiDecisionBlock"];
export type AiVerdict = NonNullable<AiDecisionBlock["verdict"]>;
/** What a block part carries: a table, a chart, a chip, a place in the app or a check-in's call. */
export type AiBlock = AiTable | AiChart | AiProposal | AiPlace | AiDecisionBlock;
export type AiPart = S["AiTextPart"] | S["AiBlockPart"];
export type AiTurnFeedbackResponse = S["AiTurnFeedbackResp"];
export type AiTurnCommentResponse = S["AiTurnCommentResp"];
export type AiFeedback = "up" | "down";

/**
 * Dime's check-ins (`/v1/internal/ai/checkins`; the Dime autopilot plan, step 3):
 * turns Dime starts itself on a team it runs on. Each is about one
 * fantasy day (morning, weekly on a matchup's first day, pre_lock before the
 * first tip, night the next morning) and has its own conversation (`kind`
 * checkin) whose first message is the server's brief. A proposal on an
 * automation that isn't at AI is a review (state `shadow`, never staged or
 * sent); on one at AI Dime sends it itself or leaves it as a chip, and the call's
 * decision block says which. The user marks each call agree or disagree.
 */
export type AiCheckin = S["AiCheckinSummary"];
export type AiCheckinKind = AiCheckin["kind"];
/** The kinds the AI desk can run now: an `event` check-in starts only when news comes in (step 6). */
export type AiCheckinRunKind = NonNullable<S["AiCheckinRunReq"]["kind"]>;
/** What came in about a rostered player that a check-in took: a verdict change or a news item. */
export type AiCheckinEvent = AiCheckin["events"][number];
export type AiCheckinState = AiCheckin["state"];
export type AiAutopilotTeam = S["AiAutopilotTeam"];
export type AiCheckins = S["AiCheckinsData"];
export type AiCheckinsResponse = S["AiCheckinsResp"];
export type AiCheckinResponse = S["AiCheckinResp"];
export type AiAutopilotResponse = S["AiAutopilotResp"];
export type AiDecisionVerdictResponse = S["AiDecisionVerdictResp"];

/**
 * A team's automations (the Dime autopilot plan's "Automation levels", step 5;
 * backend services/ai/autonomy.py). Each row has one level: off, notify (an
 * email), act (Court Vision does it, no AI) or ai (Dime does it, and sends its
 * own moves within the policy). Every level says whether it can be picked and
 * why not; `note` says when the row does less than its level (paused, acting
 * off on the server, the lineup email off). The autopilot switch puts every row
 * that offers AI at AI.
 */
export type AiAutomationRow = S["AiAutomationRow"];
export type AiAutomationName = AiAutomationRow["row"];
export type AiLevel = AiAutomationRow["level"];
export type AiLevelOption = S["AiLevelOption"];
/** Whether the server lets Dime act at all, and the policy it acts within. */
export type AiActing = S["AiActing"];
export type AiActingPolicy = S["AiActingPolicy"];
/** What became of a check-in's change on an automation at AI: sent, blocked by a rule, refused or failed. */
export type AiDecisionAction = S["AiDecisionAction"];
export type AiActionOutcome = AiDecisionAction["outcome"];
/** A change to a team's autopilot: its check-ins, the autopilot switch, or some automations' levels (one at a time). */
export type AiAutopilotChange = {
  checkins?: boolean;
  autopilot?: boolean;
  levels?: Partial<Record<AiAutomationName, AiLevel>>;
};
/** One move Dime handled on its own (`/v1/internal/ai/actions`): sent, or held back as a chip with the rule. */
export type AiAutopilotAction = S["AiAutopilotActionItem"];
export type AiAutopilotActionsResponse = S["AiAutopilotActionsResp"];
/** The account's AI features (`/v1/internal/ai/settings`): Dime's memory and its side of the Draft desk. */
export type AiFeatures = S["AiFeatures"];
export type AiSettingsResponse = S["AiSettingsResp"];

/**
 * Dime's notes (`/v1/internal/ai/notes`): what the agent keeps between
 * conversations, per team or about the user. A note is never edited in place:
 * an edit retires it and writes its replacement, so a retired note says who
 * retired it and why. The user's own notes (author `user`) outrank Dime's.
 */
export type AiNote = S["AiNote"];
export type AiNoteKind = AiNote["kind"];
export type AiNoteCreateRequest = S["AiNoteCreateReq"];
export type AiNoteEditRequest = S["AiNoteEditReq"];
export type AiNoteListResponse = S["AiNoteListResp"];
export type AiNoteResponse = S["AiNoteResp"];

/**
 * The move ledger (`/v1/internal/teams/{id}/move-outcomes`): every add and drop
 * a team made (read off its daily rosters, whoever made it) and what it earned
 * in the box scores, over the day it counted, the rest of that matchup and two
 * weeks. Rebuilt each night after the games.
 */
export type MoveOutcome = S["MoveOutcome"];
export type MoveOutcomeList = S["MoveOutcomeListData"];
export type MoveOutcomeListResponse = S["MoveOutcomeListResp"];
export type MoveSourceSummary = S["MoveSourceSummary"];
export type MoveOutcomePlayer = S["MoveOutcomePlayer"];
export type MoveSource = MoveOutcome["source"];
export type MoveScope = MoveOutcomeList["scope"];
export type MoveWindowName = "day" | "matchup" | "two_weeks";

/** One side of a window: its player's games, and for the add the ones he started here. */
export interface MoveSide {
  games: number;
  points?: number;
  totals?: Record<string, number>;
  counted_games?: number;
  counted_points?: number;
  counted_totals?: Record<string, number>;
}

/** One scoring window of a move (the API types `windows` loosely; this is its shape). */
export interface MoveWindow {
  start: string;
  end: string;
  /** False while the window is still being played. */
  complete: boolean;
  add: MoveSide | null;
  drop: MoveSide | null;
  /** Points leagues: the add's points minus the drop's. */
  net?: number;
  /** Category leagues with both sides: the categories the add won, lost and tied against the drop. */
  edge?: { won: string[]; lost: string[]; tied: string[] };
}
