"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import type { ComposerHandle } from "@/components/ai/Composer";
import dk from "@/components/desk/desk.module.css";
import { ACCOUNT_DESK, AI_DESK } from "@/components/desk/routes";
import { aiMessage } from "@/hooks/useAi";
import { useAskDimeDraft, useDimeDraftQuery, useSetDimeDraftSeat } from "@/hooks/useDimeDraft";
import { draftKeys } from "@/hooks/useDrafts";
import { useLatestCallback } from "@/hooks/useLatestCallback";
import { toApiError } from "@/lib/api-error";
import { prose } from "@/lib/ai-prose";
import {
  askWhy,
  dimePickFor,
  draftedIds,
  failedLine,
  noteForPick,
  pickOf,
  pickToAsk,
  recapFacts,
  roomSignature,
  seatBusy,
  seatPicks,
  seatReason,
  type DimePick,
} from "@/lib/draft-dime";
import type { DimeDraftNote, DimeDraftNoteKind, DimeDraftRoom, DraftSession } from "@/types/draft";
import { DimeChat } from "./DimeChat";
import { shortName } from "./format";
import type { RoomModel } from "./model";
import s from "./draft.module.css";

const AUTOMATION_SETTINGS = `${ACCOUNT_DESK}?v=automation`;

// ---------------------------------------------------------------------------
// The room's side of Dime: the view, the writes, and the two things the room
// does on its own (asking for Dime's pick as the user's pick comes up, and
// reading the draft again when the seat changed it)
// ---------------------------------------------------------------------------

export interface RoomDime {
  room: DimeDraftRoom | null;
  /** The account switched Dime in draft rooms off: the rail says where to turn it back on, and nothing else. */
  switchedOff: boolean;
  /** Dime holds the user's seat and its loop is running: the room's own pick controls stand down. */
  drafting: boolean;
  /** Dime's pick for the user's next pick while it stands: the board highlights him. */
  pick: DimePick | null;
  ask: (kind: DimeDraftNoteKind) => void;
  asking: boolean;
  setSeat: (on: boolean) => void;
  settingSeat: boolean;
}

export function useRoomDime(model: RoomModel, session: DraftSession): RoomDime {
  const query = useDimeDraftQuery(session.id, !model.demo);
  const askM = useAskDimeDraft(session.id);
  const seatM = useSetDimeDraftSeat(session.id);
  const room = query.data?.available ? query.data : null;
  const queryClient = useQueryClient();

  // A seat pick adds a pick: everything that reads the draft reads it
  // again, as after the room's own writes (the session, every board view, the recap, the lobby)
  const signature = roomSignature(room);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!signature) return;
    if (seen.current !== null && seen.current !== signature) {
      void queryClient.invalidateQueries({ queryKey: draftKeys.detail(session.id) });
      void queryClient.invalidateQueries({ queryKey: draftKeys.board(session.id) });
      void queryClient.invalidateQueries({ queryKey: draftKeys.recap(session.id) });
      void queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    }
    seen.current = signature;
  }, [signature, session.id, queryClient]);

  // Whether Dime can hold the seat follows the room's seat, shape, link and state: read the view
  // again when one of them changes (the view doesn't poll while nothing runs)
  const seatShape = [session.my_slot, session.status, session.espn_league_id, session.pick_order.length, session.rounds, session.draft_type].join(":");
  const shapeSeen = useRef<string | null>(null);
  const refetchView = useLatestCallback(() => void query.refetch());
  useEffect(() => {
    if (shapeSeen.current !== null && shapeSeen.current !== seatShape && query.data) refetchView();
    shapeSeen.current = seatShape;
  }, [seatShape, query.data, refetchView]);

  const ask = useLatestCallback((kind: DimeDraftNoteKind, quiet = false) => {
    askM.mutate(kind, {
      onError: (err) => {
        // Asked on its own while another note started: nothing the user needs to hear
        if (quiet && toApiError(err).code === "AI_DRAFT_BUSY") return;
        toast.error(aiMessage(err, "Dime couldn't start that note"));
      },
    });
  });

  // Dime's pick: once per pick, when the user's pick is `lead` picks away or nearer, and once
  // more if another seat drafts the player it chose first (a retake is its own key)
  const drafted = useMemo(() => draftedIds(session), [session]);
  const asked = useRef(new Set<string>());
  const due = pickToAsk(room, session, drafted);
  // The note it replaces, for a retake: "-" when there is none yet
  const held = due != null ? (noteForPick(room?.notes ?? [], due)?.id ?? "-") : null;
  useEffect(() => {
    if (due == null || askM.isPending) return;
    const key = `${session.id}:${due}:${held}`;
    if (asked.current.has(key)) return;
    asked.current.add(key);
    ask("pick", true);
  }, [due, held, session.id, askM.isPending, ask]);
  const pick = useMemo(() => dimePickFor(room, session, drafted), [room, session, drafted]);

  return {
    room,
    switchedOff: query.data?.switched_off === true,
    drafting: seatBusy(room),
    pick,
    ask: (kind) => ask(kind),
    asking: askM.isPending,
    setSeat: (on) =>
      seatM.mutate(on, {
        onSuccess: () => toast.success(on ? "Dime has your seat: it drafts to the end" : "Dime hands your seat back after this pick"),
        onError: (err) => toast.error(aiMessage(err, on ? "Dime couldn't take your seat" : "Couldn't take your seat back")),
      }),
    settingSeat: seatM.isPending,
  };
}

// ---------------------------------------------------------------------------
// The section
// ---------------------------------------------------------------------------

interface DimeRailProps {
  dime: RoomDime;
  session: DraftSession;
  onFocus: (playerId: number) => void;
  /** The chat's box: the board's Ask Dime puts its question there. */
  box?: React.Ref<ComposerHandle>;
  /** Put a question in the chat's box (Ask why on Dime's pick). */
  onAsk: (question: string) => void;
}

export function DimeRail({ dime, session, onFocus, box, onAsk }: DimeRailProps) {
  const room = dime.room;
  const drafted = useMemo(() => draftedIds(session), [session]);
  if (!room) return dime.switchedOff ? <SwitchedOff /> : null;

  const completed = session.status === "completed";
  const writing = room.running != null || dime.asking;
  const pickNote = completed || dime.drafting ? null : noteForPick(room.notes, session.my_next_pick);
  const recapNote = room.notes.find((n) => n.kind === "recap") ?? null;
  const took = seatPicks(room.notes);
  const mock = session.kind === "mock";
  const seat = room.seat;
  const seatLine = seatReason(seat);

  return (
    <section className={s.section} aria-label="Dime">
      <div className={s.sectionHead}>
        <span className={dk.label}>Dime</span>
        <span className={dk.sub}>{dime.drafting ? "has your seat" : pickNote?.state === "running" ? "choosing…" : writing ? "writing…" : ""}</span>
      </div>

      <div className={`${s.sectionBody} ${s.dime}`}>
        {/* ---- the seat (a mock following nothing) ---- */}
        {mock && !completed ? (
          <div className={s.dimeBlock}>
            {seat.state !== "off" && seat.live ? (
              <>
                <div className={s.dimeHead}>
                  <span className={`${s.tag} ${s.tagAccent}`}>SEAT</span>
                  <span className={dk.sub}>
                    {seat.state === "stopping" ? "Handing your seat back after this pick" : `Dime is drafting your seat${took.length ? ` · ${took.length} pick${took.length === 1 ? "" : "s"} so far` : ""}`}
                  </span>
                </div>
                {seat.state === "drafting" ? (
                  <button type="button" className={`${dk.btn} ${dk.btnSmall}`} disabled={dime.settingSeat} onClick={() => dime.setSeat(false)}>
                    Take my seat back
                  </button>
                ) : null}
              </>
            ) : (
              <>
                {seatLine ? <span className={dk.sub}>{seatLine}.</span> : null}
                <button
                  type="button"
                  className={`${dk.btn} ${dk.btnSmall}`}
                  disabled={!room.can_seat || dime.settingSeat || writing}
                  title={room.can_seat ? "Dime drafts your seat to the end of the mock; the autopicker runs the others. Each pick is an AI desk turn." : room.seat_blocker ?? undefined}
                  onClick={() => dime.setSeat(true)}
                >
                  Let Dime draft my seat
                </button>
              </>
            )}
          </div>
        ) : null}

        {/* ---- Dime's pick for the coming pick (the board highlights him) ---- */}
        {!completed && !dime.drafting && session.my_next_pick != null ? (
          <PickLine
            note={pickNote}
            pick={dime.pick}
            nextPick={session.my_next_pick}
            lead={room.lead}
            picksAway={session.picks_until_my_turn}
            drafted={drafted}
            writing={writing}
            onAsk={() => dime.ask("pick")}
            onAskWhy={(p) => onAsk(askWhy(p))}
            onFocus={onFocus}
          />
        ) : null}

        {/* ---- what Dime took from the seat ---- */}
        {took.length > 0 ? (
          <div className={s.dimeBlock}>
            <span className={dk.label}>Dime&apos;s picks</span>
            {took.slice(-4).reverse().map((n) => (
              <SeatPick key={n.id} note={n} onFocus={onFocus} />
            ))}
          </div>
        ) : null}

        {/* ---- the recap ---- */}
        {completed ? (
          recapNote?.state === "running" ? (
            <Writing line="Dime is writing the recap…" />
          ) : recapNote?.state === "done" ? (
            <RecapNote note={recapNote} />
          ) : (
            <div className={s.dimeBlock}>
              {recapNote?.state === "failed" ? <span className={s.dimeFailed}>{failedLine(recapNote)}</span> : null}
              <span className={dk.sub}>Dime reads the recap: your grade, your reaches and steals, and what the league&apos;s seats did.</span>
              <button type="button" className={`${dk.btn} ${dk.btnSmall} ${dk.btnPrimary}`} disabled={writing} onClick={() => dime.ask("recap")}>
                Recap with Dime
              </button>
            </div>
          )
        ) : null}
      </div>

      {/* ---- the room's chat ---- */}
      <DimeChat key={session.id} ref={box} session={session} chatId={room.chat_id ?? null} />
    </section>
  );
}

/**
 * Dime's pick in the rail: one line, since the board carries the highlight and the reason, and
 * Ask why to take it up in the chat. Before the pick is near it says when Dime picks, with a
 * button to ask now.
 */
function PickLine({
  note,
  pick,
  nextPick,
  lead,
  picksAway,
  drafted,
  writing,
  onAsk,
  onAskWhy,
  onFocus,
}: {
  note: DimeDraftNote | null;
  pick: DimePick | null;
  nextPick: number;
  lead: number;
  picksAway: number | null;
  drafted: ReadonlySet<number>;
  writing: boolean;
  onAsk: () => void;
  onAskWhy: (pick: DimePick) => void;
  onFocus: (playerId: number) => void;
}) {
  if (note?.state === "running") return <Writing line={`Dime is choosing your pick for #${nextPick}…`} />;
  if (pick) {
    return (
      <div className={s.dimeBlock}>
        <div className={s.dimeHead}>
          <span className={`${s.tag} ${s.tagAccent}`}>PICK #{pick.forPick}</span>
          <button type="button" className={s.dimeShow} onClick={() => onFocus(pick.playerId)} title="Show him on the board">
            {pick.name}
            {pick.position ? ` · ${pick.position}` : ""}
          </button>
          <span className={s.right}>
            <button type="button" className={s.dimeAskWhy} onClick={() => onAskWhy(pick)} title="Puts the question in Dime's chat, to send or change">
              Ask why
            </button>
          </span>
        </div>
      </div>
    );
  }
  const chosen = note ? pickOf(note) : null;
  if (chosen && drafted.has(chosen.playerId)) {
    return (
      <div className={s.dimeBlock}>
        <span className={dk.sub}>{chosen.name}, Dime&apos;s pick for #{nextPick}, was drafted first. The board&apos;s calls still stand.</span>
      </div>
    );
  }
  return (
    <div className={s.dimeBlock}>
      {note?.state === "failed" ? <span className={s.dimeFailed}>{failedLine(note)}</span> : null}
      {!note && picksAway != null && picksAway > lead ? (
        <span className={dk.sub}>Dime picks for you when #{nextPick} is {lead} picks away.</span>
      ) : null}
      <button type="button" className={`${dk.btn} ${dk.btnSmall}`} disabled={writing} onClick={onAsk} title="Dime chooses one player for this pick, with a line on why. It is an AI desk turn.">
        {note ? "Ask Dime again" : `Dime's pick for #${nextPick} now`}
      </button>
    </div>
  );
}

/** Dime in draft rooms is off for the account: one line saying where it comes back on. */
function SwitchedOff() {
  return (
    <section className={s.section} aria-label="Dime">
      <div className={s.sectionHead}>
        <span className={dk.label}>Dime</span>
        <span className={dk.sub}>off</span>
      </div>
      <div className={`${s.sectionBody} ${s.dime}`}>
        <p className={s.dimeEmpty}>
          Dime in draft rooms is off. Turn it on in{" "}
          <Link href={AUTOMATION_SETTINGS} className={s.dimeLink}>
            Account, AI and automation
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

function Writing({ line }: { line: string }) {
  return (
    <div className={s.dimeBlock} aria-busy>
      <span className={dk.sub}>{line}</span>
      <span className={dk.skel} style={{ display: "block" }} />
    </div>
  );
}

function NoteLink({ conversationId }: { conversationId: number | null }) {
  if (conversationId == null) return null;
  return (
    <Link href={`${AI_DESK}?c=${conversationId}`} className={dk.link} title="Open Dime's conversation in the AI desk, to ask a follow-up">
      Follow up
    </Link>
  );
}

function Prose({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className={s.dimeText}>
      {prose(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>{b.spans.map((sp, j) => (sp.bold ? <strong key={j}>{sp.text}</strong> : <span key={j}>{sp.text}</span>))}</p>
        ) : (
          <ul key={i}>
            {b.items.map((item, j) => (
              <li key={j}>{item.map((sp, k) => (sp.bold ? <strong key={k}>{sp.text}</strong> : <span key={k}>{sp.text}</span>))}</li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function SeatPick({ note, onFocus }: { note: DimeDraftNote; onFocus: (playerId: number) => void }) {
  const t = note.took as { overall_pick?: number; round?: number; player_id?: number; name?: string; position?: string; reason?: string } | null;
  if (!t) return null;
  return (
    <div className={s.dimeTook}>
      <button type="button" className={s.dimeFact} onClick={() => t.player_id != null && onFocus(t.player_id)}>
        <span>#{t.overall_pick ?? note.for_pick}</span>
        <span>{t.name ? shortName(t.name) : "—"}</span>
        <span>{t.position ?? "—"}</span>
        <span>{t.round != null ? `R${t.round}` : ""}</span>
      </button>
      {t.reason ? <span className={dk.sub}>{t.reason}</span> : null}
    </div>
  );
}

function RecapNote({ note }: { note: DimeDraftNote }) {
  const f = recapFacts(note);
  return (
    <div className={s.dimeBlock}>
      <div className={s.dimeHead}>
        <span className={s.tag}>RECAP</span>
        <span className={dk.sub}>
          {[f.grade ? `grade ${f.grade}` : null, f.place != null && f.seats ? `${f.place} of ${f.seats}` : null, f.byDime ? `${f.byDime} by Dime` : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className={s.right}>
          <NoteLink conversationId={note.conversation_id} />
        </span>
      </div>
      <Prose text={note.text} />
    </div>
  );
}
