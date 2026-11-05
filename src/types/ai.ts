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
 * turns Dime starts itself on a team it runs on, in shadow. Each is about one
 * fantasy day (morning, weekly on a matchup's first day, pre_lock before the
 * first tip, night the next morning) and has its own conversation (`kind`
 * checkin) whose first message is the server's brief. Its proposals are
 * `shadow` (never staged or sent) and its calls are decision blocks the user
 * marks agree or disagree.
 */
export type AiCheckin = S["AiCheckinSummary"];
export type AiCheckinKind = AiCheckin["kind"];
export type AiCheckinState = AiCheckin["state"];
export type AiAutopilotTeam = S["AiAutopilotTeam"];
export type AiCheckins = S["AiCheckinsData"];
export type AiCheckinsResponse = S["AiCheckinsResp"];
export type AiCheckinResponse = S["AiCheckinResp"];
export type AiAutopilotResponse = S["AiAutopilotResp"];
export type AiDecisionVerdictResponse = S["AiDecisionVerdictResp"];

/**
 * How much Dime may do on a team (the Dime autopilot plan, step 5; backend
 * services/ai/autonomy.py): shadow logs what it would do, suggest makes its
 * changes chips you send, act has the server send them itself within the
 * policy. `mode` is the team's; `own` a kind of move's, standing in for it when
 * set (null follows the team's); `effective` what each kind is now (act reads as
 * suggest while acting is off on the server, everything is shadow while paused).
 */
export type AiAutonomy = S["AiAutonomy"];
export type AiAutonomyMode = AiAutonomy["mode"];
export type AiCapability = keyof S["AiAutonomyModes"];
/** Whether the server lets Dime act at all, and the policy it acts within. */
export type AiActing = S["AiActing"];
export type AiActingPolicy = S["AiActingPolicy"];
/** What became of a check-in's change in an area that acts: sent, blocked by a rule, refused or failed. */
export type AiDecisionAction = S["AiDecisionAction"];
export type AiActionOutcome = AiDecisionAction["outcome"];
/** A change to a team's autopilot: any of the switch, the team's mode and a kind's own. */
export type AiAutopilotChange = {
  on?: boolean;
  mode?: AiAutonomyMode;
  own?: Partial<Record<AiCapability, AiAutonomyMode | null>>;
};

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
