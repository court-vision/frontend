"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { LayoutList, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import { DeskDialog } from "@/components/desk/DeskDialog";
import { TeamSwitch, type DeskTeam } from "@/components/desk/TeamSwitch";
import { ACCOUNT_DESK, AI_DESK } from "@/components/desk/routes";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import {
  useAiConversationQuery,
  useAiConversationsQuery,
  useAiComment,
  useAiFeedback,
  useAiTurn,
  useAiUsageQuery,
  aiMessage,
  useCreateAiConversation,
  useDeleteAiConversation,
} from "@/hooks/useAi";
import { useChipTray } from "@/hooks/useAiProposals";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { draftKey } from "@/lib/ai-drafts";
import { toApiError, userMessage } from "@/lib/api-error";
import { teamName, teamTag } from "@/lib/account";
import { useUIStore } from "@/stores/useUIStore";
import type { AiConversationSummary, AiFeedback } from "@/types/ai";
import { ChipTray, type ChipActions } from "./Chips";
import { Composer, type ComposerHandle } from "./Composer";
import { Thread } from "./Thread";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

const KEYS: Array<[string, string]> = [
  ["/", "write"],
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

export function AiPage({ initialConversation }: { initialConversation: number | null }) {
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
        <span className={s.heroTitle}>Sign in to talk to CV AI</span>
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
        <span className={s.heroTitle}>{err.code === "AI_DISABLED" ? "CV AI is turned off" : "CV AI couldn't be reached"}</span>
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
        <span className={s.heroTitle}>CV AI is invite-only for now</span>
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
          <span style={{ fontWeight: 600 }}>CV AI</span>
        </DeskBar>
        <div className={s.thread}>{gate}</div>
        <DeskStatus keys={[["T", "theme"]]} />
      </div>
    );
  }
  return <AiDesk initialConversation={initialConversation} monthUsd={usage.data?.month_usd ?? 0} capUsd={usage.data?.cap_usd ?? 0} />;
}

function AiDesk({ initialConversation, monthUsd, capUsd }: { initialConversation: number | null; monthUsd: number; capUsd: number }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [current, setCurrent] = useState<number | null>(initialConversation);
  const [pane, setPane] = useState<"list" | "thread">("thread");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();
  const toggleTheme = useDeskTheme((st) => st.toggle);
  const composer = useRef<ComposerHandle>(null);
  const threadEl = useRef<HTMLDivElement>(null);

  const list = useAiConversationsQuery(true);
  const detail = useAiConversationQuery(current, true);
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
    }),
    [tray.stagedIds, tray.patches, tray.busy, tray.stage, tray.unstage, tray.dismiss]
  );

  const selected = useSelectedTeam();
  const setSelectedTeam = useUIStore((st) => st.setSelectedTeam);
  const teams = useMemo<DeskTeam[]>(
    () => selected.teams.map((t) => ({ id: t.team_id, name: teamName(t), tag: teamTag(t) })),
    [selected.teams]
  );

  // ---- URL: ?c=<id> is the open conversation

  const go = useCallback((id: number | null, mode: "push" | "replace" = "push") => {
    setCurrent(id);
    setPane("thread");
    const url = id != null ? `${AI_DESK}?c=${id}` : AI_DESK;
    if (`${window.location.pathname}${window.location.search}` === url) return;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const c = Number(new URLSearchParams(window.location.search).get("c"));
      setCurrent(Number.isInteger(c) && c > 0 ? c : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // A conversation that's gone (deleted elsewhere, someone else's) falls back to a new one
  const missing = detail.isError && toApiError(detail.error).status === 404;
  useEffect(() => {
    if (missing) go(null, "replace");
  }, [missing, go]);

  // ---- the live turn: shown until the stored copy of it arrives

  const conversation = current != null ? detail.data : undefined;
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
      let id = current;
      if (id == null) {
        try {
          id = (await create.mutateAsync(selected.teamId)).id;
        } catch (err) {
          toast.error(aiMessage(err, "Couldn't start a conversation"));
          composer.current?.fill(message);
          return;
        }
        go(id, "replace");
      }
      pinned.current = true;
      const ok = await send(id, message);
      if (!ok) {
        // Refused before it began: give the message back so it can be sent again
        composer.current?.fill(message);
      }
    },
    [current, create, selected.teamId, go, send]
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

  const newConversation = useCallback(() => {
    go(null);
    setTimeout(() => composer.current?.focus(), 0);
  }, [go]);

  // ---- keys

  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || (e.target as HTMLElement | null)?.closest?.('[role="dialog"]')) return;
      if (e.key === "/") {
        e.preventDefault();
        composer.current?.focus();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        newConversation();
      } else if (e.key === "t" || e.key === "T") {
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newConversation, toggleTheme]);

  // ---- rendering

  // A conversation whose first message was refused has nothing in it: list it only while it's open
  const conversations = useMemo(() => (list.data ?? []).filter((c) => c.turns > 0 || c.id === current), [list.data, current]);
  const pinnedTeam = conversation?.team_id != null ? selected.teams.find((t) => t.team_id === conversation.team_id) : undefined;
  const loadingThread = current != null && detail.isLoading;
  const full = conversation?.full === true;
  const title = conversation?.title ?? (current == null ? "New conversation" : "");

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
  } else if (current == null && selected.teams.length > 0) {
    banner = (
      <>
        <span className={dk.sub}>About</span>
        <TeamSwitch teams={teams} teamId={selected.teamId} onTeam={setSelectedTeam} onAdd={() => router.push(`${ACCOUNT_DESK}?add=1`)} container={root} />
      </>
    );
  }

  return (
    <div ref={setRoot} className={dk.desk}>
      <DeskBar
        desk="ai"
        right={
          <span className={dk.sub} title="Your CV AI spend this month, and your cap">
            ${monthUsd.toFixed(2)} of ${capUsd.toFixed(0)}
          </span>
        }
      >
        <button type="button" className={`${dk.iconBtn} ${s.listToggle}`} aria-label={pane === "list" ? "Show the conversation" : "Show conversations"} onClick={() => setPane((p) => (p === "list" ? "thread" : "list"))}>
          <LayoutList size={14} />
        </button>
        <span style={{ fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        {pinnedTeam ? <span className={dk.sub}>{teamName(pinnedTeam)}</span> : null}
        {current != null ? (
          <button type="button" className={dk.iconBtn} aria-label="Delete this conversation" title="Delete this conversation" disabled={running || tray.busy} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
          </button>
        ) : null}
      </DeskBar>

      <div className={s.body} data-pane={pane}>
        <ConversationList conversations={conversations} loading={list.isLoading} current={current} onOpen={(id) => go(id)} onNew={newConversation} />

        <div className={s.main}>
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
                <Thread turns={turns} live={showLive} chips={chipActions} onVote={onVote} onComment={onComment} />
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
            placeholder={running ? "Answering…" : current == null ? "Ask about your team, a player, or the free-agent pool" : "Ask a follow-up"}
            banner={banner}
            draftKey={draftKey(userId, current)}
            onSend={(m) => void onSend(m)}
          />
        </div>
      </div>

      <DeskStatus keys={KEYS}>
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
                  go(null, "replace");
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
        CV AI reads your matchup, your roster, the free-agent pool and box scores, then tells you what it would do. Tables are
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

function ConversationList({
  conversations,
  loading,
  current,
  onOpen,
  onNew,
}: {
  conversations: AiConversationSummary[];
  loading: boolean;
  current: number | null;
  onOpen: (id: number) => void;
  onNew: () => void;
}) {
  return (
    <nav className={s.list} aria-label="Conversations">
      <div className={s.listHead}>
        <span className={dk.label}>Conversations</span>
        <span className={dk.spacer} />
        <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onNew}>
          <Plus size={13} /> New
        </button>
      </div>
      <div className={s.listScroll}>
        {loading ? (
          <div className={s.rowEmpty} aria-busy>
            <span className={dk.skel} style={{ width: "80%" }} />
          </div>
        ) : conversations.length === 0 ? (
          <div className={s.rowEmpty}>Nothing yet. Your conversations show up here.</div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${s.row} ${c.id === current ? s.rowOn : ""}`}
              aria-current={c.id === current ? "page" : undefined}
              onClick={() => onOpen(c.id)}
            >
              <span className={s.rowTitle}>{c.title ?? "Untitled"}</span>
              <span className={dk.sub}>
                {relative(c.updated_at)} · {c.turns} {c.turns === 1 ? "turn" : "turns"}
              </span>
            </button>
          ))
        )}
      </div>
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
