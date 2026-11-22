"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { BookOpen, ChevronDown, ChevronLeft, ChevronUp, Loader2, Maximize2, Minimize2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AutopilotMark } from "@/components/desk/AutopilotMark";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import { DeskDialog } from "@/components/desk/DeskDialog";
import { TeamSwitch, type DeskTeam } from "@/components/desk/TeamSwitch";
import { ACCOUNT_DESK, AI_DESK, DRAFT_DESK } from "@/components/desk/routes";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import {
  useAiCheckinsQuery,
  useAiConversationQuery,
  useAiConversationsQuery,
  useAiComment,
  useAiDecisionVerdict,
  useAiFeedback,
  useAiTurn,
  useAiUsageQuery,
  aiMessage,
  useCreateAiConversation,
  useDeleteAiConversation,
} from "@/hooks/useAi";
import { useChipTray } from "@/hooks/useAiProposals";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { autopilotLive, checkinBanner } from "@/lib/ai-autonomy";
import { aiLocation, aiSearch, nextExpand, type AiExpand, type AiLocation, type AiPaneView } from "@/lib/ai-desk";
import { draftKey, loadDraft, saveDraft } from "@/lib/ai-drafts";
import { pausedLine, showsTimeline } from "@/lib/ai-timeline";
import { toApiError, userMessage } from "@/lib/api-error";
import { teamName, teamTag } from "@/lib/account";
import { useUIStore } from "@/stores/useUIStore";
import type { AiConversationSummary, AiFeedback, AiVerdict } from "@/types/ai";
import { ChipTray, type ChipActions } from "./Chips";
import { Composer, type ComposerHandle } from "./Composer";
import { Thread } from "./Thread";
import { TimelinePane } from "./Timeline";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/** The keys with the timeline beside the chat, and with the chat alone. */
/** The pane a phone shows (one at a time), and the history entry's key that keeps it. */
type NarrowPane = "timeline" | "chat";
const PANE_STATE = "aiPane";

const KEYS: Array<[string, string]> = [
  ["[ ]", "day"],
  ["↑ ↓", "move"],
  ["⏎", "open in chat"],
  ["E", "expand a pane"],
  ["/", "ask"],
  ["N", "new conversation"],
  ["T", "theme"],
];
/** The Notebook or Move results beside the chat. */
const PANE_KEYS: Array<[string, string]> = [
  ["E", "expand a pane"],
  ["/", "ask"],
  ["N", "new conversation"],
  ["T", "theme"],
];
const CHAT_KEYS: Array<[string, string]> = [
  ["/", "ask"],
  ["N", "new conversation"],
  ["T", "theme"],
];

/** Questions known to work with today's lookups (docs/AI_AGENT_PLAN.md). */
const EXAMPLES = [
  "Who are the best free agents to stream this week?",
  "How's my matchup looking, category by category?",
  "Which of my players have the fewest games left this week?",
  "Pull the last 5 box scores for my top two free-agent options.",
  "Find me a pickup for tonight and set it up.",
];

export function AiPage({ initial }: { initial: AiLocation }) {
  const { isLoaded, isSignedIn } = useAuth();
  const usage = useAiUsageQuery();
  const access = usage.data?.access === true;

  let gate: React.ReactNode = null;
  if (!isLoaded || (isSignedIn && usage.isLoading)) {
    gate = (
      <div className={s.hero} aria-busy>
        <span className={dk.skel} style={{ width: "60%" }} />
        <span className={dk.skel} style={{ width: "40%" }} />
      </div>
    );
  } else if (!isSignedIn) {
    gate = (
      <div className={s.hero}>
        <span className={s.heroTitle}>Sign in to talk to Dime</span>
        <span className={s.heroSub}>
          Your fantasy assistant: it reads your teams, matchups and the free-agent pool, and answers with the numbers behind them.
        </span>
        <div className={s.linkRow}>
          <Link href={`/sign-in?redirect_url=${encodeURIComponent(AI_DESK)}`} className={`${dk.btn} ${dk.btnPrimary}`}>
            Sign in
          </Link>
        </div>
      </div>
    );
  } else if (usage.error) {
    const err = toApiError(usage.error);
    gate = (
      <div className={s.hero}>
        <span className={s.heroTitle}>{err.code === "AI_DISABLED" ? "Dime is turned off" : "Dime couldn't be reached"}</span>
        <span className={s.heroSub}>{err.code === "AI_DISABLED" ? "It's switched off on this server for now." : aiMessage(err)}</span>
        {err.code !== "AI_DISABLED" ? (
          <div className={s.linkRow}>
            <button type="button" className={dk.btn} onClick={() => void usage.refetch()}>
              Try again
            </button>
          </div>
        ) : null}
      </div>
    );
  } else if (!access) {
    gate = (
      <div className={s.hero}>
        <span className={s.heroTitle}>Dime is invite-only for now</span>
        <span className={s.heroSub}>
          It&apos;s open to a few people while its costs are measured. Your teams, the Week desk and Scout work as before.
        </span>
      </div>
    );
  }

  if (gate) {
    return (
      <div className={dk.desk}>
        <DeskBar desk="ai">
          <span style={{ fontWeight: 600 }}>Dime</span>
        </DeskBar>
        <div className={s.thread}>{gate}</div>
        <DeskStatus keys={[["T", "theme"]]} />
      </div>
    );
  }
  return <AiDesk initial={initial} monthUsd={usage.data?.month_usd ?? 0} capUsd={usage.data?.cap_usd ?? 0} />;
}

function AiDesk({ initial, monthUsd, capUsd }: { initial: AiLocation; monthUsd: number; capUsd: number }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [loc, setLoc] = useState<AiLocation>(initial);
  const current = loc.conversation;
  // Which pane is expanded: the desk's own state, not the URL's
  const [expand, setExpand] = useState<AiExpand>("none");
  // Narrow screens show one pane at a time: the chat once a conversation is open, else the day
  const [narrow, setNarrow] = useState<NarrowPane>(initial.conversation != null ? "chat" : "timeline");
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The chats unroll under the chat pane's header, in the pane (no menu floating over it)
  const [chatsOpen, setChatsOpen] = useState(false);
  const router = useRouter();
  const toggleTheme = useDeskTheme((st) => st.toggle);
  const composer = useRef<ComposerHandle>(null);
  const threadEl = useRef<HTMLDivElement>(null);

  const list = useAiConversationsQuery(true);
  const detail = useAiConversationQuery(current, true);
  const checkins = useAiCheckinsQuery(true);
  const verdict = useAiDecisionVerdict(current);
  const create = useCreateAiConversation();
  const remove = useDeleteAiConversation();
  const feedback = useAiFeedback(current);
  const comment = useAiComment(current);
  const { userId } = useAuth();
  const { live, running, send, clear } = useAiTurn();
  // The chips staged in this conversation: the Week desk's tray under the thread sends them
  const tray = useChipTray(current);
  const chipActions = useMemo<ChipActions>(
    () => ({
      stagedIds: tray.stagedIds,
      patches: tray.patches,
      busy: tray.busy,
      onStage: tray.stage,
      onUnstage: tray.unstage,
      onDismiss: tray.dismiss,
      onApply: tray.apply,
      applying: tray.applying,
    }),
    [tray.stagedIds, tray.patches, tray.busy, tray.stage, tray.unstage, tray.dismiss, tray.apply, tray.applying]
  );

  const selected = useSelectedTeam();
  const setSelectedTeam = useUIStore((st) => st.setSelectedTeam);
  const teams = useMemo<DeskTeam[]>(
    () => selected.teams.map((t) => ({ id: t.team_id, name: teamName(t), tag: teamTag(t) })),
    [selected.teams]
  );
  // The desk reads one team: the bar's, or the first while none is picked (what the switch shows)
  const teamId = selected.teamId ?? teams[0]?.id ?? null;
  const dimeTeam = checkins.data?.teams.find((t) => t.team_id === teamId);
  // No timeline when the team's check-ins are off; while that is still loading, keep the split
  const hasTimeline = !checkins.data || showsTimeline(dimeTeam);
  // Without one the left pane opens only for the Notebook or the results
  const leftShown = hasTimeline || loc.view !== "timeline";
  const autopilot = autopilotLive(dimeTeam, checkins.data?.acting ?? null);
  const settingsHref = `${ACCOUNT_DESK}?v=automation${teamId != null ? `&team=${teamId}` : ""}`;

  // ---- URL: ?v= the left pane, ?d= the day, ?c= the conversation in the chat (src/lib/ai-desk.ts)

  const locRef = useRef(loc);
  useEffect(() => {
    locRef.current = loc;
  }, [loc]);
  // Each history entry keeps the pane a phone showed with it, so Back and Forward bring it back
  const narrowRef = useRef(narrow);
  useEffect(() => {
    narrowRef.current = narrow;
  }, [narrow]);
  const go = useCallback((patch: Partial<AiLocation>, mode: "push" | "replace" = "push", pane?: NarrowPane) => {
    const next = { ...locRef.current, ...patch };
    locRef.current = next;
    setLoc(next);
    const url = `${AI_DESK}${aiSearch(next)}`;
    if (`${window.location.pathname}${window.location.search}` === url) return;
    const state = { [PANE_STATE]: pane ?? narrowRef.current };
    if (mode === "push") window.history.pushState(state, "", url);
    else window.history.replaceState(state, "", url);
  }, []);

  /** Puts a conversation (or a new one) in the chat, and the chat in view. */
  const showChat = useCallback(
    (id: number | null, mode: "push" | "replace" = "push") => {
      go({ conversation: id }, mode, "chat");
      setChatsOpen(false);
      setNarrow("chat");
      setExpand((e) => (e === "timeline" ? "none" : e));
    },
    [go]
  );
  const onView = useCallback(
    (view: AiPaneView) => {
      go({ view }, "push", "timeline");
      setNarrow("timeline");
      setExpand((e) => (e === "chat" ? "none" : e));
    },
    [go]
  );

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const q = new URLSearchParams(window.location.search);
      const next = aiLocation(q.get("v"), q.get("c"), q.get("d"));
      locRef.current = next;
      setLoc(next);
      // The pane the entry was left on; an entry from outside the desk shows the chat with a conversation
      const pane: unknown = (e.state as Record<string, unknown> | null)?.[PANE_STATE];
      setNarrow(pane === "chat" || pane === "timeline" ? pane : next.conversation != null ? "chat" : "timeline");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // A conversation that's gone (deleted elsewhere, someone else's) leaves a new one in its place
  const missing = detail.isError && toApiError(detail.error).status === 404;
  useEffect(() => {
    if (missing) go({ conversation: null }, "replace");
  }, [missing, go]);

  // ---- the live turn: shown until the stored copy of it arrives

  const conversation = current != null && detail.data?.id === current ? detail.data : undefined;
  const isCheckin = conversation?.kind === "checkin";
  // A note Dime wrote in a draft room (a plan, a pick, a recap), opened from its recap to follow up
  const isDraft = conversation?.kind === "draft";
  const turns = useMemo(() => conversation?.history ?? [], [conversation]);
  const liveHere = live && live.conversationId === current ? live : null;
  const stored = liveHere?.done?.turn_id != null && turns.some((t) => t.id === liveHere.done!.turn_id);
  useEffect(() => {
    if (stored) clear();
  }, [stored, clear]);
  const showLive = liveHere && !stored ? liveHere : null;

  // Keep the newest text in view while it streams, unless the user scrolled up
  const pinned = useRef(true);
  useEffect(() => {
    const el = threadEl.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [turns.length, showLive?.parts, showLive?.status, current]);

  // ---- sending

  const onSend = useCallback(
    async (message: string) => {
      const origin = current;
      // A message that didn't go goes back: into the composer while the chat still shows `shown`,
      // else kept as the draft of the chat it was typed in. Never over newer text, or another chat's
      const giveBack = (shown: number | null) => {
        if (locRef.current.conversation === shown) {
          if (!loadDraft(draftKey(userId, shown)).trim()) composer.current?.fill(message);
          return;
        }
        const key = draftKey(userId, origin);
        if (!loadDraft(key).trim()) saveDraft(key, message);
      };
      let id = current;
      if (id == null) {
        try {
          id = (await create.mutateAsync(teamId)).id;
        } catch (err) {
          toast.error(aiMessage(err, "Couldn't start a conversation"));
          giveBack(null);
          return;
        }
        // Into the chat only while it still shows the new conversation: one opened meanwhile (a
        // check-in from the timeline) stays where it is, and the message goes to its own conversation
        if (locRef.current.conversation == null) showChat(id, "replace");
      }
      pinned.current = true;
      const ok = await send(id, message);
      // Refused before it began: give the message back so it can be sent again
      if (!ok) giveBack(id);
    },
    [current, create, teamId, showChat, send, userId]
  );

  const onVote = useCallback(
    (turnId: number, value: AiFeedback | null) => {
      feedback.mutate({ turnId, feedback: value }, { onError: (err) => toast.error(userMessage(err, "Couldn't save that")) });
    },
    [feedback]
  );

  const onComment = useCallback(
    (turnId: number, text: string | null) =>
      comment
        .mutateAsync({ turnId, comment: text })
        .then(() => true)
        .catch((err) => {
          toast.error(aiMessage(err, "Couldn't save the note"));
          return false;
        }),
    [comment]
  );

  const onVerdict = useCallback(
    (decisionId: number, value: AiVerdict | null) => {
      verdict.mutate({ decisionId, verdict: value }, { onError: (err) => toast.error(userMessage(err, "Couldn't save that")) });
    },
    [verdict]
  );

  const newConversation = useCallback(() => {
    showChat(null);
    setTimeout(() => composer.current?.focus(), 0);
  }, [showChat]);

  // ---- keys ([ ] and the arrows are the timeline's own, in Timeline.tsx)

  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || target?.closest?.('[role="dialog"], [data-radix-popper-content-wrapper]')) return;
      if (e.key === "Escape") {
        setChatsOpen(false);
      } else if (e.key === "/") {
        e.preventDefault();
        setNarrow("chat");
        setExpand((x) => (x === "timeline" ? "none" : x));
        setTimeout(() => composer.current?.focus(), 0);
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        newConversation();
      } else if ((e.key === "e" || e.key === "E") && leftShown) {
        e.preventDefault();
        setExpand(nextExpand);
      } else if (e.key === "t" || e.key === "T") {
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leftShown, newConversation, toggleTheme]);

  // ---- rendering

  // A conversation whose first message was refused has nothing in it: list it only while it's open
  const conversations = useMemo(() => (list.data ?? []).filter((c) => c.turns > 0 || c.id === current), [list.data, current]);
  const pinnedTeam = conversation?.team_id != null ? selected.teams.find((t) => t.team_id === conversation.team_id) : undefined;
  const loadingThread = current != null && detail.isLoading;
  const full = conversation?.full === true;
  const title = current == null ? "New conversation" : (conversation?.title ?? "");
  const chatExpanded = expand === "chat";

  let banner: React.ReactNode = null;
  if (full) {
    banner = (
      <>
        <span>This conversation is full.</span>
        <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={newConversation}>
          Start a new one
        </button>
      </>
    );
  } else if (isCheckin && conversation) {
    banner = <span className={dk.sub}>{checkinBanner(conversation)}</span>;
  } else if (isDraft) {
    banner = (
      <>
        <span className={dk.sub}>A note Dime wrote in a draft room.</span>
        <Link href={DRAFT_DESK} className={dk.link}>
          Draft desk
        </Link>
      </>
    );
  }

  const chat = (
    <section className={`${s.pane} ${s.chatPane}`} aria-label="Chat">
      <header className={s.paneHead}>
        {leftShown ? (
          <button type="button" className={`${dk.btn} ${dk.btnSmall} ${s.narrowOnly}`} onClick={() => setNarrow("timeline")}>
            <ChevronLeft size={12} /> {hasTimeline ? "Timeline" : "Notebook"}
          </button>
        ) : null}
        <span className={dk.label}>Chat</span>
        <span className={s.paneTitle} title={title}>
          {title}
        </span>
        {pinnedTeam && pinnedTeam.team_id !== teamId ? <span className={dk.sub}>{teamName(pinnedTeam)}</span> : null}
        <span className={dk.spacer} />
        {!hasTimeline && teamId != null ? (
          <span className={`${s.paneNote} ${s.wideOnly}`}>
            Check-ins are off on this team, so there&apos;s no timeline.{" "}
            <Link href={settingsHref} className={dk.link}>
              Turn them on
            </Link>
          </span>
        ) : null}
        {!leftShown ? (
          <button type="button" className={dk.ghost} title="Every note Dime keeps" onClick={() => onView("notebook")}>
            <BookOpen size={13} /> Notebook
          </button>
        ) : null}
        <button
          type="button"
          className={`${dk.btn} ${dk.btnSmall}`}
          aria-expanded={chatsOpen}
          aria-controls="ai-chats"
          title="Your conversations"
          onClick={() => setChatsOpen((o) => !o)}
        >
          Chats {chatsOpen ? <ChevronUp size={12} className={dk.chev} /> : <ChevronDown size={12} className={dk.chev} />}
        </button>
        <button type="button" className={`${dk.btn} ${dk.btnSmall}`} title="A new conversation (N)" onClick={newConversation}>
          <Plus size={13} /> New
        </button>
        {current != null ? (
          <button
            type="button"
            className={dk.iconBtn}
            aria-label="Delete this conversation"
            title="Delete this conversation"
            disabled={running || tray.busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={13} />
          </button>
        ) : null}
        {leftShown ? (
          <button
            type="button"
            className={`${dk.iconBtn} ${s.wideOnly}`}
            aria-label={chatExpanded ? "Show the timeline beside it" : "Expand the chat"}
            title={chatExpanded ? "Show the timeline beside it (E)" : "Expand the chat (E)"}
            onClick={() => setExpand(chatExpanded ? "none" : "chat")}
          >
            {chatExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        ) : null}
      </header>
      {chatsOpen ? <ChatList conversations={conversations} loading={list.isLoading} current={current} onOpen={(id) => showChat(id)} /> : null}
      <div
        ref={threadEl}
        className={s.thread}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <div className={s.column}>
          {loadingThread ? (
            <div className={s.turn} aria-busy>
              <span className={dk.skel} style={{ width: "40%", alignSelf: "flex-end" }} />
              <span className={dk.skel} style={{ width: "90%" }} />
              <span className={dk.skel} style={{ width: "70%" }} />
            </div>
          ) : turns.length === 0 && !showLive ? (
            <Empty onPick={(q) => void onSend(q)} disabled={running} />
          ) : (
            <Thread
              turns={turns}
              live={showLive}
              chips={chipActions}
              onVote={onVote}
              onComment={onComment}
              checkin={isCheckin}
              onVerdict={isCheckin ? onVerdict : undefined}
            />
          )}
        </div>
      </div>
      <ChipTray
        days={tray.days}
        blocked={tray.blocked}
        sendingDay={tray.sendingDay}
        onCancelSwap={tray.cancelSwap}
        onUndrop={tray.undrop}
        onUnstageMove={tray.unstageMove}
        onDiscardDay={tray.discardDay}
        onDiscardAll={tray.discardAll}
        onSend={tray.sendDays}
      />
      <Composer
        ref={composer}
        disabled={full}
        busy={running || create.isPending}
        placeholder={
          running
            ? "Answering…"
            : current == null
              ? "Ask about your team, a player, or the free-agent pool"
              : isCheckin
                ? "Ask Dime about this check-in"
                : isDraft
                  ? "Ask Dime about this draft"
                  : "Ask a follow-up"
        }
        banner={banner}
        draftKey={draftKey(userId, current)}
        onSend={(m) => void onSend(m)}
      />
    </section>
  );

  return (
    <div ref={setRoot} className={dk.desk}>
      <DeskBar
        desk="ai"
        right={
          <>
            {autopilot ? <AutopilotMark team={teams.find((t) => t.id === teamId)?.name} teamId={teamId} /> : null}
            <span className={dk.sub} title="What your chats with Dime have cost this month, and their cap">
              ${monthUsd.toFixed(2)} of ${capUsd.toFixed(0)}
            </span>
          </>
        }
      >
        <TeamSwitch teams={teams} teamId={teamId} onTeam={setSelectedTeam} onAdd={() => router.push(`${ACCOUNT_DESK}?add=1`)} container={root} />
      </DeskBar>

      <div className={s.split} data-expand={leftShown ? expand : "none"} data-narrow={leftShown ? narrow : "chat"} data-solo={leftShown ? undefined : ""}>
        {leftShown ? (
          <TimelinePane
            teamId={teamId}
            teams={teams}
            hasTimeline={hasTimeline}
            paused={pausedLine(dimeTeam)}
            settingsHref={settingsHref}
            view={hasTimeline ? loc.view : loc.view === "timeline" ? "notebook" : loc.view}
            onView={onView}
            day={loc.day}
            onDay={(day) => go({ day }, "replace")}
            current={current}
            onOpen={(id) => showChat(id)}
            expanded={expand === "timeline"}
            onExpand={() => setExpand((e) => (e === "timeline" ? "none" : "timeline"))}
            onChat={() => setNarrow("chat")}
            onClose={() => {
              go({ view: "timeline" }, "push", "chat");
              setExpand("none");
              setNarrow("chat");
            }}
          />
        ) : null}
        {chat}
      </div>

      <DeskStatus keys={!leftShown ? CHAT_KEYS : hasTimeline && loc.view === "timeline" ? KEYS : PANE_KEYS}>
        <span>Opus 5.5 · answers from Court Vision&apos;s lookups</span>
      </DeskStatus>

      <DeskDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this conversation?"
        description="Its questions and answers go for good. What it cost still counts toward this month's cap."
        footer={
          <button
            type="button"
            className={`${dk.btn} ${dk.btnDanger}`}
            disabled={remove.isPending}
            onClick={() => {
              if (current == null) return;
              remove.mutate(current, {
                onSuccess: () => {
                  setConfirmDelete(false);
                  go({ conversation: null }, "replace");
                },
                onError: (err) => toast.error(userMessage(err, "Couldn't delete it")),
              });
            }}
          >
            {remove.isPending ? <Loader2 size={13} className={dk.spin} /> : <Trash2 size={13} />} Delete
          </button>
        }
      />
    </div>
  );
}

function Empty({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className={s.empty}>
      <span className={s.emptyTitle}>What do you want to know?</span>
      <span className={s.emptySub}>
        Dime reads your matchup, your roster, the free-agent pool and box scores, then tells you what it would do. Tables are
        copied straight from those lookups.
      </span>
      <div className={s.examples}>
        {EXAMPLES.map((q) => (
          <button key={q} type="button" className={s.example} disabled={disabled} onClick={() => onPick(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The chats, unrolled under the chat pane's header (check-ins open from the timeline). */
function ChatList({
  conversations,
  loading,
  current,
  onOpen,
}: {
  conversations: AiConversationSummary[];
  loading: boolean;
  current: number | null;
  onOpen: (id: number) => void;
}) {
  return (
    <nav id="ai-chats" className={s.chatList} aria-label="Your conversations">
      {loading ? (
        <div className={s.rowEmpty} aria-busy>
          <span className={dk.skel} style={{ width: "60%" }} />
        </div>
      ) : conversations.length === 0 ? (
        <div className={s.rowEmpty}>Nothing yet. Your conversations show up here.</div>
      ) : (
        conversations.map((c) => (
          <button key={c.id} type="button" className={s.chatRow} aria-current={c.id === current ? "true" : undefined} onClick={() => onOpen(c.id)}>
            <span className={s.rowTitle}>{c.title ?? "Untitled"}</span>
            <span className={dk.sub}>
              {relative(c.updated_at)} · {c.turns} {c.turns === 1 ? "turn" : "turns"}
            </span>
          </button>
        ))
      )}
    </nav>
  );
}

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
