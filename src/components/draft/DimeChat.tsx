"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Composer, type ComposerHandle } from "@/components/ai/Composer";
import { Thread } from "@/components/ai/Thread";
import type { ChipActions } from "@/components/ai/Chips";
import dk from "@/components/desk/desk.module.css";
import { AI_DESK } from "@/components/desk/routes";
import { aiMessage, useAiComment, useAiConversationQuery, useAiFeedback, useAiTurn } from "@/hooks/useAi";
import { dimeDraftKey, useOpenDimeChat } from "@/hooks/useDimeDraft";
import { userMessage, toApiError } from "@/lib/api-error";
import { loadDraft, roomDraftKey } from "@/lib/ai-drafts";
import { chatStarters } from "@/lib/draft-dime";
import type { AiFeedback } from "@/types/ai";
import type { DraftSession } from "@/types/draft";
import s from "./draft.module.css";

/**
 * A move Dime proposes is staged and sent from the AI desk's tray, which the room doesn't
 * have: here its chips show what Dime proposed and stay still ("Open on the AI desk" acts on them).
 */
const STILL_CHIPS: ChipActions = {
  stagedIds: new Set<number>(),
  patches: new Map(),
  busy: true,
  onStage: () => undefined,
  onUnstage: () => undefined,
  onDismiss: () => undefined,
  onApply: () => undefined,
  applying: null,
};

/**
 * The room's Dime chat (the Draft lab rework, step 2): one AI desk conversation per room, on
 * the AI desk's own thread and box. The server gives Dime the room's state with every message
 * (the user's next pick, their picks, the punts, Dime's pick on the board), so the user can
 * ask anything, a plan included. The chat starts with its first message; each message is a
 * turn on the AI desk's budget. The handle lets the board put a question in the box.
 */
export const DimeChat = forwardRef<ComposerHandle, { session: DraftSession; chatId: number | null }>(function DimeChat({ session, chatId }, ref) {
  const { userId } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const composer = useRef<ComposerHandle>(null);
  useImperativeHandle(ref, () => ({
    focus: () => composer.current?.focus(),
    fill: (text: string) => composer.current?.fill(text),
  }), []);

  const detail = useAiConversationQuery(chatId, chatId != null);
  // The chat was deleted on the AI desk: the room has none until the next message starts one
  const gone = chatId != null && detail.isError && toApiError(detail.error).status === 404;
  useEffect(() => {
    if (gone) void queryClient.invalidateQueries({ queryKey: dimeDraftKey(userId, session.id) });
  }, [gone, queryClient, userId, session.id]);
  const current = gone ? null : chatId;
  const conversation = current != null && detail.data?.id === current ? detail.data : undefined;
  const open = useOpenDimeChat(session.id);
  const feedback = useAiFeedback(current);
  const comment = useAiComment(current);
  const { live, running, send, clear } = useAiTurn();
  const boxKey = roomDraftKey(userId, session.id);

  // ---- the live turn: shown until the stored copy of it arrives (as on the AI desk)
  const turns = useMemo(() => conversation?.history ?? [], [conversation]);
  const liveHere = live && live.conversationId === current ? live : null;
  const stored = liveHere?.done?.turn_id != null && turns.some((t) => t.id === liveHere.done!.turn_id);
  useEffect(() => {
    if (stored) clear();
  }, [stored, clear]);
  const showLive = liveHere && !stored ? liveHere : null;

  // Keep the newest text in view while it streams, unless the user scrolled up
  const threadEl = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = threadEl.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [turns.length, showLive?.parts, showLive?.status, current]);

  const onSend = useCallback(
    async (message: string) => {
      // A message that didn't go goes back in the box, unless something newer was typed there
      const giveBack = () => {
        if (!loadDraft(boxKey).trim()) composer.current?.fill(message);
      };
      let id = current;
      if (id == null) {
        try {
          id = (await open.mutateAsync(false)).id;
        } catch (err) {
          toast.error(aiMessage(err, "Couldn't start the chat"));
          giveBack();
          return;
        }
      }
      pinned.current = true;
      if (!(await send(id, message))) giveBack();
    },
    [current, open, send, boxKey]
  );

  const startOver = useCallback(() => {
    open.mutate(true, { onError: (err) => toast.error(aiMessage(err, "Couldn't start a new chat")) });
  }, [open]);

  const onVote = useCallback(
    (turnId: number, value: AiFeedback | null) =>
      feedback.mutate({ turnId, feedback: value }, { onError: (err) => toast.error(userMessage(err, "Couldn't save that")) }),
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

  const loading = current != null && detail.isLoading;
  const empty = !loading && turns.length === 0 && !showLive;
  const full = conversation?.full === true;
  const spent = turns.reduce((sum, t) => sum + (t.cost_usd ?? 0), 0);

  return (
    <div className={s.dimeChat} data-empty={empty}>
      <div className={s.dimeChatHead}>
        <span className={dk.label}>Chat</span>
        <span className={dk.sub}>{spent > 0 ? `$${spent.toFixed(2)} so far` : "each message is an AI desk turn"}</span>
        {current != null && turns.length > 0 ? (
          <span className={s.right}>
            <Link href={`${AI_DESK}?c=${current}`} className={dk.link} title="This chat on the AI desk, where Dime's proposed moves can be staged">
              Open on the AI desk
            </Link>
          </span>
        ) : null}
      </div>
      <div
        ref={threadEl}
        className={s.dimeChatThread}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <div className={s.dimeChatColumn}>
          {loading ? (
            <div aria-busy>
              <span className={dk.skel} style={{ display: "block", width: "60%" }} />
            </div>
          ) : empty ? (
            <div className={s.dimeStarters}>
              <p className={s.dimeEmpty}>Ask Dime anything about this draft: a plan, a player, a punt. It reads the board and your picks first.</p>
              {chatStarters(session).map((q) => (
                <button key={q} type="button" className={s.dimeStarter} disabled={full} onClick={() => composer.current?.fill(q)}>
                  {q}
                </button>
              ))}
            </div>
          ) : (
            <Thread turns={turns} live={showLive} chips={STILL_CHIPS} onVote={onVote} onComment={onComment} onOpen={(id) => router.push(`${AI_DESK}?c=${id}`)} />
          )}
        </div>
      </div>
      <Composer
        ref={composer}
        compact
        disabled={full}
        busy={running || open.isPending}
        placeholder={running ? "Answering…" : "Ask Dime about this draft"}
        banner={
          full ? (
            <>
              <span>This chat is full.</span>
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} disabled={open.isPending} onClick={startOver}>
                Start a new chat
              </button>
            </>
          ) : null
        }
        draftKey={boxKey}
        onSend={(m) => void onSend(m)}
      />
    </div>
  );
});
