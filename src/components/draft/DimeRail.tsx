"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import dk from "@/components/desk/desk.module.css";
import { ACCOUNT_DESK, AI_DESK } from "@/components/desk/routes";
import { aiMessage } from "@/hooks/useAi";
import { useAskDimeDraft, useDimeDraftQuery, useSetDimeDraftNotes, useSetDimeDraftSeat } from "@/hooks/useDimeDraft";
import { draftKeys } from "@/hooks/useDrafts";
import { useLatestCallback } from "@/hooks/useLatestCallback";
import { toApiError } from "@/lib/api-error";
import { prose } from "@/lib/ai-prose";
import {
  failedLine,
  latestPlan,
  noteForPick,
  noteLabel,
  pickFacts,
  pickToAsk,
  puntLine,
  recapFacts,
  roomSignature,
  seatBusy,
  seatPicks,
  seatReason,
} from "@/lib/draft-dime";
import type { DimeDraftNote, DimeDraftNoteKind, DimeDraftRoom, DraftBoardResult, DraftSession } from "@/types/draft";
import { shortName, signed } from "./format";
import type { RoomModel } from "./model";
import s from "./draft.module.css";

const AUTOMATION_SETTINGS = `${ACCOUNT_DESK}?v=automation`;

// ---------------------------------------------------------------------------
// The room's side of Dime: the view, the writes, and the two things the room
// does on its own (asking for a pick note while the switch is on, and reading
// the draft again when a note or the seat changed it)
// ---------------------------------------------------------------------------

export interface RoomDime {
  room: DimeDraftRoom | null;
  /** The account switched Dime in draft rooms off: the rail says where to turn it back on, and nothing else. */
  switchedOff: boolean;
  /** Dime holds the user's seat and its loop is running: the room's own pick controls stand down. */
  drafting: boolean;
  ask: (kind: DimeDraftNoteKind) => void;
  asking: boolean;
  setNotes: (on: boolean) => void;
  settingNotes: boolean;
  setSeat: (on: boolean) => void;
  settingSeat: boolean;
}

export function useRoomDime(model: RoomModel, session: DraftSession): RoomDime {
  const query = useDimeDraftQuery(session.id, !model.demo);
  const askM = useAskDimeDraft(session.id);
  const notesM = useSetDimeDraftNotes(session.id);
  const seatM = useSetDimeDraftSeat(session.id);
  const room = query.data?.available ? query.data : null;
  const queryClient = useQueryClient();

  // A finished plan sets punts and a seat pick adds a pick: everything that reads the draft reads it
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

  // The switch: once per pick, when the user's pick is `lead` picks away or nearer
  const asked = useRef(new Set<string>());
  const due = pickToAsk(room, session);
  useEffect(() => {
    if (due == null || askM.isPending) return;
    const key = `${session.id}:${due}`;
    if (asked.current.has(key)) return;
    asked.current.add(key);
    ask("pick", true);
  }, [due, session.id, askM.isPending, ask]);

  return {
    room,
    switchedOff: query.data?.switched_off === true,
    drafting: seatBusy(room),
    ask: (kind) => ask(kind),
    asking: askM.isPending,
    setNotes: (on) =>
      notesM.mutate(on, {
        onSuccess: () => toast.success(on ? "Dime writes a note as each of your picks comes up" : "Notes at your picks off"),
        onError: (err) => toast.error(aiMessage(err, "Couldn't change that")),
      }),
    settingNotes: notesM.isPending,
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
  board: DraftBoardResult | null;
  onFocus: (playerId: number) => void;
  /** Put the room's punts back to what they were before a plan set them. */
  onRestorePunts: ((punts: string[]) => void) | null;
  updating: boolean;
}

export function DimeRail({ dime, session, board, onFocus, onRestorePunts, updating }: DimeRailProps) {
  const room = dime.room;
  const labels = useMemo(
    () => Object.fromEntries((board?.meta?.category_need ?? []).map((n) => [n.key, n.label])),
    [board?.meta?.category_need]
  );
  if (!room) return dime.switchedOff ? <SwitchedOff /> : null;

  const completed = session.status === "completed";
  const writing = room.running != null || dime.asking;
  const planNote = room.notes.find((n) => n.kind === "plan") ?? null;
  const plan = latestPlan(room.notes);
  const pickNote = completed ? null : noteForPick(room.notes, session.my_next_pick);
  const recapNote = room.notes.find((n) => n.kind === "recap") ?? null;
  const took = seatPicks(room.notes);
  const mock = session.kind === "mock";
  const seat = room.seat;
  const seatLine = seatReason(seat);

  return (
    <section className={s.section} aria-label="Dime">
      <div className={s.sectionHead}>
        <span className={dk.label}>Dime</span>
        <span className={dk.sub}>{dime.drafting ? "has your seat" : writing ? "writing…" : ""}</span>
        {!completed ? (
          <span className={s.right}>
            <span className={dk.sub}>Notes at my picks</span>
            <button
              type="button"
              role="switch"
              aria-checked={room.notes_on}
              aria-label="A note from Dime as each of your picks comes up"
              title={`A note from Dime whenever your pick is ${room.lead} picks away or nearer. Each note is an AI desk turn.`}
              className={s.switch}
              disabled={dime.settingNotes}
              onClick={() => dime.setNotes(!room.notes_on)}
            />
          </span>
        ) : null}
      </div>

      <div className={`${s.sectionBody} ${s.dime}`}>
        {/* ---- the plan ---- */}
        {planNote?.state === "running" ? (
          <Writing what="a plan" />
        ) : plan ? (
          <div className={s.dimeBlock}>
            <div className={s.dimeHead}>
              <span className={s.tag}>PLAN</span>
              <span className={dk.sub}>{puntLine(plan.punts, labels)}</span>
              <span className={s.right}>
                {onRestorePunts && plan.punts_before && !samePunts(plan.punts_before, plan.punts) && samePunts(session.punts, plan.punts) ? (
                  <button
                    type="button"
                    className={`${dk.btn} ${dk.btnSmall}`}
                    disabled={updating}
                    title={`Put the room's punts back to ${puntLine(plan.punts_before, labels)}`}
                    onClick={() => onRestorePunts(plan.punts_before ?? [])}
                  >
                    Undo punts
                  </button>
                ) : null}
                <NoteLink note={plan} />
              </span>
            </div>
            <p className={s.dimePlan}>{plan.plan}</p>
            {!completed ? (
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} disabled={writing || dime.drafting} onClick={() => dime.ask("plan")}>
                Plan again
              </button>
            ) : null}
          </div>
        ) : !completed ? (
          <div className={s.dimeBlock}>
            {planNote?.state === "failed" ? <span className={s.dimeFailed}>{failedLine(planNote)}</span> : null}
            <span className={dk.sub}>Dime reads the room and sets the plan it drafts to{session.scoring_format === "categories" ? ", punts included" : ""}.</span>
            <button type="button" className={`${dk.btn} ${dk.btnSmall} ${dk.btnPrimary}`} disabled={writing || dime.drafting} onClick={() => dime.ask("plan")}>
              Plan my draft
            </button>
          </div>
        ) : null}

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

        {/* ---- the coming pick ---- */}
        {!completed && !dime.drafting ? (
          pickNote?.state === "running" ? (
            <Writing what={`a note for pick ${pickNote.for_pick}`} />
          ) : pickNote?.state === "done" ? (
            <PickNote note={pickNote} onFocus={onFocus} />
          ) : session.my_next_pick != null ? (
            <div className={s.dimeBlock}>
              {pickNote?.state === "failed" ? <span className={s.dimeFailed}>{failedLine(pickNote)}</span> : null}
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} disabled={writing} onClick={() => dime.ask("pick")}>
                {pickNote ? "Ask again" : `Note for pick ${session.my_next_pick}`}
              </button>
            </div>
          ) : null
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
            <Writing what="the recap" />
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
    </section>
  );
}

function samePunts(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const x = [...(a ?? [])].sort();
  const y = [...(b ?? [])].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
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

function Writing({ what }: { what: string }) {
  return (
    <div className={s.dimeBlock} aria-busy>
      <span className={dk.sub}>Dime is writing {what}…</span>
      <span className={dk.skel} style={{ display: "block" }} />
    </div>
  );
}

function NoteLink({ note }: { note: DimeDraftNote }) {
  if (note.conversation_id == null) return null;
  return (
    <Link href={`${AI_DESK}?v=drafts&c=${note.conversation_id}`} className={dk.link} title="Open the note's conversation in the AI desk, to ask a follow-up">
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

function PickNote({ note, onFocus }: { note: DimeDraftNote; onFocus: (playerId: number) => void }) {
  const f = pickFacts(note);
  return (
    <div className={s.dimeBlock}>
      <div className={s.dimeHead}>
        <span className={s.tag}>{noteLabel(note).toUpperCase()}</span>
        <span className={dk.sub}>{f.onClock ? "on the clock" : f.picksUntil != null ? `${f.picksUntil} pick${f.picksUntil === 1 ? "" : "s"} away when written` : ""}</span>
        <span className={s.right}>
          <NoteLink note={note} />
        </span>
      </div>
      {f.top.length > 0 ? (
        <div className={s.dimeFacts}>
          {f.top.map((t, i) => (
            <button key={`${t.player_id}-${i}`} type="button" className={s.dimeFact} onClick={() => t.player_id != null && onFocus(t.player_id)} title={t.reason ?? undefined}>
              <span>{i + 1}</span>
              <span>{shortName(t.name)}</span>
              <span>{t.position ?? "—"}</span>
              <span>{signed(t.score, 0)}</span>
            </button>
          ))}
        </div>
      ) : null}
      <Prose text={note.text} />
      {f.gone.length > 0 ? (
        <span className={dk.sub}>
          Likely gone before #{f.goneBefore ?? "?"}: {f.gone.map((g) => shortName(g.name)).join(", ")}
        </span>
      ) : null}
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
          <NoteLink note={note} />
        </span>
      </div>
      <Prose text={note.text} />
    </div>
  );
}
