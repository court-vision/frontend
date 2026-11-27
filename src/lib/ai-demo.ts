/**
 * The AI desk's demo: the Home demo's account on the same Thursday (Nov 19), opened on its
 * autopilot team. Dime's day is on the timeline (the night follow-up, the morning plan, a late
 * scratch it answered, the pre-lock look) and one chat is open in the chat. Nothing here is real
 * and nothing is sent anywhere: the page opens signed out, so team, league and opponent names
 * are invented (the Home demo's own).
 *
 * The desk's hooks read the session through `useDeskAuth`, which answers "signed out" inside the
 * demo, so their queries are off and answer from the query client `seedAiDemo` filled, under the
 * keys a signed-out visitor's queries use.
 */
import type { QueryClient } from "@tanstack/react-query";
import { aiKeys } from "@/hooks/useAi";
import type {
  AiAsks,
  AiAutomationName,
  AiAutomationRow,
  AiBlock,
  AiCheckin,
  AiCheckins,
  AiConversation,
  AiConversationSummary,
  AiDecisionBlock,
  AiNote,
  AiPart,
  AiTimeline,
  AiTimelineCall,
  AiTimelineCheckin,
  AiTurn,
  MoveOutcomeList,
} from "@/types/ai";
import type { DeskTeam } from "@/components/desk/TeamSwitch";
import { shiftDay } from "./ai-timeline";
import { etInstant } from "./local-time";

export const AI_DEMO_DATE = "2026-11-19";
const YESTERDAY = "2026-11-18";
const TOMORROW = "2026-11-20";

/** The Home demo's autopilot team, the one the desk opens on. */
export const AI_DEMO_TEAM = 30;
/** The chat the desk opens with. */
export const AI_DEMO_CONVERSATION = 9101;
export const AI_DEMO_MONTH_USD = 2.4;
export const AI_DEMO_CAP_USD = 10;

/** The Home demo's five teams, for the bar's switch. Only the autopilot team has Dime's day. */
export const AI_DEMO_TEAMS: DeskTeam[] = [
  { id: 30, name: "Set and Forget", tag: "ESPN · PTS" },
  { id: 25, name: "Paint Beasts", tag: "ESPN · PTS" },
  { id: 21, name: "Nine Lives", tag: "ESPN · CATS" },
  { id: 23, name: "Glass Cleaners", tag: "ESPN · PTS" },
  { id: 24, name: "Bank Shots", tag: "ESPN · PTS" },
];

const at = (hhmm: string, date: string = AI_DEMO_DATE) => new Date(etInstant(date, hhmm)!).toISOString();

// ---- notes

const note = (id: number, kind: AiNote["kind"], text: string, written: string = AI_DEMO_DATE): AiNote => ({
  note_id: id,
  kind,
  text,
  author: "dime",
  team_id: AI_DEMO_TEAM,
  written_on: written,
  recheck_on: null,
  retired_by: null,
  retired_on: null,
  retired_reason: null,
});

const PLAN = note(
  601,
  "plan",
  "Up 655 to 512.5 with more games left: protect the lead. Start whoever has a game, stream the last add on Friday, keep Reid over any streamer."
);
const LESSON = note(602, "lesson", "Reid's minutes held at 30+ with Gobert back. Keep him over a streamer.", YESTERDAY);
const PLAYER = note(603, "player", "Antetokounmpo: left knee, out Thursday. Recheck before Saturday's game.");
const NOTES: AiNote[] = [PLAN, PLAYER, LESSON];

// ---- the day's check-ins and their calls

function call(
  id: number,
  c: Pick<AiTimelineCall, "area" | "automation" | "call" | "summary" | "reason">,
  sentAt: string | null = null,
  message = "Sent to ESPN"
): AiTimelineCall {
  return {
    decision_id: id,
    proposal_id: null,
    verdict: null,
    result: null,
    action: sentAt ? { outcome: "sent", at: sentAt, message, rule: null } : null,
    ...c,
  };
}

const PICKUP = call(
  701,
  {
    area: "adds_drops",
    automation: "scheduled_pickup",
    call: "change",
    summary: "Add Ajay Mitchell, drop Jordan Clarkson",
    reason: "Mitchell has three games left this week to Clarkson's two, and has scored 6.2 more a game over two weeks. One of the matchup's four adds; two are left after it.",
  },
  at("06:02"),
  "Scheduled before the first game"
);
const KEEP_FILL = call(702, {
  area: "lineup",
  automation: "auto_lineup",
  call: "hold",
  summary: "Keep auto-lineup's fill for tonight",
  reason: "Ten starters have games and nobody on the bench outscores them.",
});
const SWAP = call(
  703,
  {
    area: "lineup",
    automation: "auto_lineup",
    call: "change",
    summary: "Start Hartenstein at UT for Antetokounmpo",
    reason: "Antetokounmpo is out against Houston. Hartenstein plays at the Lakers at 10:00 PM ET, averages 31.4 here, and is the only bench player with a game.",
  },
  at("18:11")
);
const SET = call(704, {
  area: "lineup",
  automation: "auto_lineup",
  call: "hold",
  summary: "Lineup set: ten starters, ten games",
  reason: "After the Hartenstein swap every active slot has a game tonight.",
});

type CheckinSpec = Pick<AiTimelineCheckin, "checkin_id" | "kind" | "date" | "title" | "conversation_id" | "cost_usd"> & {
  ran: string;
  calls: AiTimelineCall[];
  notes?: AiNote[];
  events?: AiTimelineCheckin["events"];
};

function checkin(c: CheckinSpec): AiTimelineCheckin {
  const sent = c.calls.filter((x) => x.action?.outcome === "sent").length;
  return {
    checkin_id: c.checkin_id,
    team_id: AI_DEMO_TEAM,
    kind: c.kind,
    date: c.date,
    title: c.title,
    state: "done",
    reason: null,
    manual: false,
    due_at: c.ran,
    started_at: c.ran,
    finished_at: new Date(Date.parse(c.ran) + 70_000).toISOString(),
    conversation_id: c.conversation_id,
    cost_usd: c.cost_usd,
    decisions: c.calls.length,
    changes: c.calls.filter((x) => x.call === "change").length,
    sent,
    agree: 0,
    disagree: 0,
    events: c.events ?? [],
    calls: c.calls,
    notes: c.notes ?? [],
    ask: null,
  };
}

const NIGHT = checkin({
  checkin_id: 801,
  kind: "night",
  date: YESTERDAY,
  title: "Wednesday went 192 to 128.",
  ran: at("05:40"),
  conversation_id: null,
  cost_usd: 0.03,
  calls: [],
  notes: [LESSON],
});
const MORNING = checkin({
  checkin_id: 802,
  kind: "morning",
  date: AI_DEMO_DATE,
  title: "Added Mitchell for Clarkson; kept the fill.",
  ran: at("06:00"),
  conversation_id: 9202,
  cost_usd: 0.05,
  calls: [PICKUP, KEEP_FILL],
  notes: [PLAN],
});
const SCRATCH = checkin({
  checkin_id: 803,
  kind: "event",
  date: AI_DEMO_DATE,
  title: "Started Hartenstein for Antetokounmpo, who is out.",
  ran: at("18:10"),
  conversation_id: 9201,
  cost_usd: 0.04,
  calls: [SWAP],
  notes: [PLAYER],
  events: [
    {
      source: "availability",
      player_id: 203507,
      news_id: null,
      received_at: at("18:08"),
      summary: "Antetokounmpo ruled out vs HOU (left knee)",
      verdict: "OUT",
    },
  ],
});
const PRE_LOCK = checkin({
  checkin_id: 804,
  kind: "pre_lock",
  date: AI_DEMO_DATE,
  title: "Lineup set: ten starters, ten games.",
  ran: at("18:30"),
  conversation_id: null,
  cost_usd: 0.03,
  calls: [SET],
});

const TODAY_TIMELINE: AiTimeline = {
  team_id: AI_DEMO_TEAM,
  date: AI_DEMO_DATE,
  today: AI_DEMO_DATE,
  starts_at: at("03:00"),
  ends_at: at("03:00", TOMORROW),
  first_tip: at("19:00"),
  checkins_on: true,
  checkins: [NIGHT, MORNING, SCRATCH, PRE_LOCK],
  upcoming: [],
  asks: [],
  notes_due: [],
};

/**
 * Any other day the desk steps to: nothing ran (or, tomorrow, what is scheduled), so the day
 * arrows never land on "Couldn't read the day" in a demo whose queries can't fetch.
 */
function quietDay(teamId: number, date: string): AiTimeline {
  const tomorrow = date === TOMORROW;
  return {
    ...TODAY_TIMELINE,
    team_id: teamId,
    date,
    starts_at: at("03:00", date),
    ends_at: at("03:00", shiftDay(date, 1)),
    first_tip: tomorrow ? at("19:00", date) : null,
    checkins_on: teamId === AI_DEMO_TEAM,
    checkins: [],
    upcoming:
      tomorrow && teamId === AI_DEMO_TEAM
        ? [
            { kind: "night", date: AI_DEMO_DATE, due_at: at("05:40", date) },
            { kind: "morning", date, due_at: at("06:00", date) },
            { kind: "pre_lock", date, due_at: at("18:30", date) },
          ]
        : [],
    asks: [],
    notes_due: [],
  };
}

const YESTERDAY_TIMELINE: AiTimeline = {
  ...TODAY_TIMELINE,
  date: YESTERDAY,
  starts_at: at("03:00", YESTERDAY),
  ends_at: at("03:00"),
  first_tip: at("19:30", YESTERDAY),
  checkins: [
    checkin({
      checkin_id: 790,
      kind: "morning",
      date: YESTERDAY,
      title: "Kept the lineup and the lane.",
      ran: at("06:00", YESTERDAY),
      conversation_id: null,
      cost_usd: 0.04,
      calls: [
        call(690, {
          area: "streaming",
          automation: "stream_lane",
          call: "hold",
          summary: "Keep Reid through Friday",
          reason: "Three games in four nights, and his minutes are back above 30.",
        }),
      ],
    }),
    checkin({
      checkin_id: 791,
      kind: "pre_lock",
      date: YESTERDAY,
      title: "Lineup set.",
      ran: at("19:00", YESTERDAY),
      conversation_id: null,
      cost_usd: 0.02,
      calls: [
        call(691, {
          area: "lineup",
          automation: "auto_lineup",
          call: "hold",
          summary: "Lineup set: nine starters, nine games",
          reason: "Every player with a game is in an active slot.",
        }),
      ],
    }),
  ],
};

// ---- the teams Dime runs on

const ROWS: Array<[AiAutomationName, string]> = [
  ["lineup", "Lineup"],
  ["daily_actions", "Daily actions"],
  ["lanes", "Stream lanes"],
  ["late_scratch", "Late scratches and news"],
  ["checkins", "Check-ins"],
];

const LEVELS = ["off", "notify", "act", "ai"] as const;

const automationRows = (): AiAutomationRow[] =>
  ROWS.map(([row, label]) => ({
    row,
    label,
    level: "ai",
    note: "Autopilot sets these",
    options: LEVELS.map((level) => ({ level, available: true, reason: null })),
  }));

/** A day's check-in as the check-ins list and a conversation carry it: without its calls, notes and ask. */
function checkinSummary(c: AiTimelineCheckin): AiCheckin {
  const summary: Partial<AiTimelineCheckin> = { ...c };
  delete summary.calls;
  delete summary.notes;
  delete summary.ask;
  return summary as AiCheckin;
}

const CHECKINS: AiCheckins = {
  month_usd: AI_DEMO_MONTH_USD,
  cap_usd: AI_DEMO_CAP_USD,
  acting: { available: true, writes: true, policy: { adds_per_day: 1, pause_refused: 3, pause_same_block: 3, seed_protected: 6 } },
  features: { memory: true, draft_rooms: true },
  checkins: [PRE_LOCK, SCRATCH, MORNING, NIGHT].map(checkinSummary),
  teams: [
    {
      team_id: AI_DEMO_TEAM,
      on: true,
      autopilot: true,
      active_since: at("06:00", "2026-11-02"),
      paused_at: null,
      paused_by: null,
      paused_reason: null,
      next: { kind: "night", date: AI_DEMO_DATE, due_at: at("05:40", TOMORROW) },
      rows: automationRows(),
    },
  ],
};

// ---- conversations

let turnId = 5000;
function turn(message: string, when: string, parts: AiPart[], cost = 0.06): AiTurn {
  return { id: ++turnId, message, created_at: when, parts, outcome: "ok", cost_usd: cost, feedback: null, comment: null };
}
const text = (t: string): AiPart => ({ kind: "text", text: t });
const block = (b: AiBlock): AiPart => ({ kind: "block", block: b });

const decision = (c: AiTimelineCall, id: string): AiDecisionBlock => ({
  type: "decision",
  id,
  decision_id: c.decision_id,
  proposal_id: c.proposal_id,
  area: c.area,
  automation: c.automation,
  call: c.call,
  summary: c.summary,
  reason: c.reason,
  action: c.action,
  verdict: c.verdict,
});

const STREAMING: AiConversation = {
  id: AI_DEMO_CONVERSATION,
  kind: "chat",
  team_id: AI_DEMO_TEAM,
  title: "The matchup and the weekend",
  created_at: at("19:20"),
  updated_at: at("19:31"),
  full: false,
  checkin: null,
  turns: 2,
  history: [
    turn("How's my matchup looking?", at("19:20"), [
      text(
        "You lead Net Profits 655 to 512.5 after four days, and the rest of the week leans your way: 23 games left to their 21, with a projected finish of 1,362 to 1,023."
      ),
      block({
        type: "chart",
        kind: "bar",
        id: "b1",
        title: "Points by day, you and Net Profits",
        tools: ["get_matchup"],
        result_ids: ["r1"],
        total_rows: 4,
        x: { key: "date", label: "Day" },
        categories: ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"],
        series: [
          { key: "you", label: "Set and Forget", values: [201, 220, 192, 42] },
          { key: "opp", label: "Net Profits", values: [163, 188, 128, 33.5] },
        ],
      }),
      text(
        "Tonight is the one soft spot: Antetokounmpo is out, so Hartenstein starts in his place at UT. The 6:10 PM check-in sent that swap, and every active slot has a game."
      ),
    ]),
    turn("Who should I stream this weekend?", at("19:31"), [
      text("Four free agents play at least twice from Friday to Sunday. Mitchell is already yours since this morning, so these are for one of the two adds left:"),
      block({
        type: "table",
        id: "b2",
        title: "Free agents, Friday to Sunday",
        tools: ["get_free_agents", "get_schedule"],
        result_ids: ["r2", "r3"],
        total_rows: 4,
        columns: [
          { key: "player", label: "Player" },
          { key: "team", label: "Team" },
          { key: "games", label: "Games" },
          { key: "fpts", label: "FPTS/G, 14 days" },
          { key: "rostered", label: "Rostered %" },
        ],
        rows: [
          ["Keon Ellis", "SAC", 3, 27.8, 21],
          ["Sam Merrill", "CLE", 3, 24.6, 9],
          ["Guerschon Yabusele", "NYK", 3, 23.9, 14],
          ["Kris Dunn", "LAC", 2, 26.1, 18],
        ],
      }),
      text(
        "I'd take **Ellis for Huerter on Friday morning**: the most games and the best two weeks of the four. Huerter plays once more this week. Say the word and I'll schedule it, or leave it to the morning check-in."
      ),
    ]),
  ],
};

const SCRATCH_CHAT: AiConversation = {
  id: 9201,
  kind: "checkin",
  team_id: AI_DEMO_TEAM,
  title: SCRATCH.title,
  created_at: SCRATCH.started_at,
  updated_at: SCRATCH.finished_at!,
  full: false,
  checkin: checkinSummary(SCRATCH),
  turns: 1,
  history: [
    turn("Event check-in: Antetokounmpo ruled out vs HOU (left knee) at 6:08 PM ET. First tip 7:00 PM ET.", SCRATCH.started_at, [
      text(
        "Antetokounmpo won't play tonight. Hartenstein is the only bench player with a game (at the Lakers, 10:00 PM ET), so he takes the UT slot. Late scratches are at AI on this team, so the swap went to ESPN."
      ),
      block(decision(SWAP, "d1")),
    ], 0.04),
  ],
};

const MORNING_CHAT: AiConversation = {
  id: 9202,
  kind: "checkin",
  team_id: AI_DEMO_TEAM,
  title: MORNING.title,
  created_at: MORNING.started_at,
  updated_at: MORNING.finished_at!,
  full: false,
  checkin: checkinSummary(MORNING),
  turns: 1,
  history: [
    turn("Morning check-in · Thursday, Nov 19. Up 655 to 512.5 against Net Profits; 23 games left to their 21.", MORNING.started_at, [
      text("A quiet day with one move. Mitchell's three games beat Clarkson's two, and his last two weeks are better. The lineup auto-lineup filled already starts everyone with a game."),
      block(decision(PICKUP, "d2")),
      block(decision(KEEP_FILL, "d3")),
    ], 0.05),
  ],
};

const OLDER_CHAT: AiConversation = {
  id: 9102,
  kind: "chat",
  team_id: AI_DEMO_TEAM,
  title: "Is Reid worth keeping?",
  created_at: at("21:05", "2026-11-17"),
  updated_at: at("21:06", "2026-11-17"),
  full: false,
  checkin: null,
  turns: 1,
  history: [
    turn("Is Naz Reid worth keeping over a streamer?", at("21:05", "2026-11-17"), [
      text("Yes, for now. He has played 30 or more minutes in four of his last five, and a streamer would need three games a week to beat him. I wrote that down, so the check-ins hold him too."),
    ], 0.05),
  ],
};

const CONVERSATIONS: AiConversation[] = [STREAMING, SCRATCH_CHAT, MORNING_CHAT, OLDER_CHAT];

const summaryOf = ({ id, kind, team_id, title, created_at, updated_at, turns }: AiConversation): AiConversationSummary => ({
  id,
  kind,
  team_id,
  title,
  created_at,
  updated_at,
  turns,
});

const NO_ASKS = (teamId: number): AiAsks => ({ team_id: teamId, waiting: [], recent: [] });
const NO_MOVES = (teamId: number, scope: MoveOutcomeList["scope"]): MoveOutcomeList => ({
  team_id: teamId,
  format: "points",
  scope,
  moves: [],
  summary: [],
  total: 0,
});

/** Fills a demo's query client with the desk's sample data. */
export function seedAiDemo(client: QueryClient): void {
  const who = null;
  // A day nobody seeded gets a quiet one the moment the desk asks for it, before it first renders
  const days = aiKeys.timelines(who);
  client.getQueryCache().subscribe((e) => {
    if (e.type !== "added" || e.query.state.data !== undefined) return;
    const key = e.query.queryKey;
    if (key.length !== days.length + 2 || days.some((k, i) => key[i] !== k)) return;
    const [teamId, day] = key.slice(days.length) as [number, string];
    client.setQueryData(key, quietDay(teamId, day === "today" ? AI_DEMO_DATE : day));
  });
  client.setQueryData(aiKeys.checkins(who), CHECKINS);
  client.setQueryData(aiKeys.conversations(who), CONVERSATIONS.map(summaryOf));
  for (const c of CONVERSATIONS) client.setQueryData(aiKeys.conversation(who, c.id), c);
  client.setQueryData(aiKeys.timeline(who, AI_DEMO_TEAM, null), TODAY_TIMELINE);
  client.setQueryData(aiKeys.timeline(who, AI_DEMO_TEAM, AI_DEMO_DATE), TODAY_TIMELINE);
  client.setQueryData(aiKeys.timeline(who, AI_DEMO_TEAM, YESTERDAY), YESTERDAY_TIMELINE);
  client.setQueryData([...aiKeys.notes(who), false], NOTES);
  client.setQueryData([...aiKeys.notes(who), true], NOTES);
  for (const t of AI_DEMO_TEAMS) {
    client.setQueryData(aiKeys.asks(who, t.id), NO_ASKS(t.id));
    for (const scope of ["team", "league"] as const) client.setQueryData(aiKeys.moves(who, t.id, scope), NO_MOVES(t.id, scope));
  }
}
