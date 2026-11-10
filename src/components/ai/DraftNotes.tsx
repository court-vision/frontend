"use client";

import Link from "next/link";
import { ACCOUNT_DESK, DRAFT_DESK } from "@/components/desk/routes";
import { whenTime } from "@/components/week/format";
import { aiMessage } from "@/hooks/useAi";
import { useDimeDraftNotesQuery } from "@/hooks/useDimeDraft";
import { deskRoomLabel, failedLine, noteLabel, notePreview, puntLine } from "@/lib/draft-dime";
import type { DimeDraftDeskRoom, DimeDraftNote } from "@/types/draft";
import { DimeView, ViewLoading } from "./DimeView";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/**
 * Draft notes, in the AI desk's main area (the Dime autopilot plan, step 7):
 * every plan, pick note and recap Dime wrote in the user's draft rooms, by room,
 * newest first. A note opens here as its conversation; a room opens on the
 * Draft desk. The notes stay listed while Dime in draft rooms is switched off.
 */
export function DraftNotes({ onOpen }: { onOpen: (conversationId: number) => void }) {
  const query = useDimeDraftNotesQuery(true);
  const data = query.data;
  const rooms = data?.rooms ?? [];
  return (
    <DimeView
      label="Draft notes"
      sub={
        data?.switched_off ? (
          <>
            Dime&apos;s plans, pick notes and recaps from your draft rooms. Dime in draft rooms is off, so your rooms don&apos;t ask for new ones; turn it on in{" "}
            <Link href={`${ACCOUNT_DESK}?v=automation`} className={dk.link}>
              Account, AI and automation
            </Link>
            .
          </>
        ) : (
          "Dime's plans, pick notes and recaps from your draft rooms, newest first. Open one to read it whole or ask a follow-up."
        )
      }
    >
      {query.isLoading ? (
        <ViewLoading />
      ) : query.isError ? (
        <div className={s.rowEmpty}>{aiMessage(query.error, "Couldn't read the draft notes")}</div>
      ) : rooms.length === 0 ? (
        <div className={s.rowEmpty}>
          {data && !data.enabled ? "Dime isn't in draft rooms yet: it is switched off on the server." : "Nothing yet. Ask for a plan from the Dime section of any draft room."}
        </div>
      ) : (
        <div className={s.noteList}>
          {rooms.map((room) => (
            <Room key={room.room_id} room={room} onOpen={onOpen} />
          ))}
        </div>
      )}
    </DimeView>
  );
}

function Room({ room, onOpen }: { room: DimeDraftDeskRoom; onOpen: (conversationId: number) => void }) {
  const href = room.status === "completed" ? `${DRAFT_DESK}/${room.room_id}/recap` : `${DRAFT_DESK}/${room.room_id}`;
  const label = deskRoomLabel(room);
  return (
    <section className={s.noteGroup} aria-label={label}>
      <div className={s.noteHead}>
        <span className={dk.label}>{label}</span>
        <span className={dk.sub}>{room.kind === "mock" ? "mock" : "real draft"}{room.status === "completed" ? ", finished" : room.status === "abandoned" ? ", abandoned" : ""}</span>
        <Link href={href} className={dk.link}>
          Open the room
        </Link>
      </div>
      {room.notes.map((note) => (
        <Note key={note.id} note={note} onOpen={onOpen} />
      ))}
    </section>
  );
}

function Note({ note, onOpen }: { note: DimeDraftNote; onOpen: (conversationId: number) => void }) {
  const failed = failedLine(note);
  const line = notePreview(note.text);
  const id = note.conversation_id;
  return (
    <div className={s.noteRow}>
      <div className={s.noteHead}>
        <span className={s.sourceTag} data-source="dime">
          {noteLabel(note)}
        </span>
        {note.kind === "plan" && note.plan ? <span className={dk.sub}>{puntLine(note.punts)}</span> : null}
        <span className={dk.sub}>{whenTime(note.created_at)}</span>
        {id != null ? (
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} style={{ marginLeft: "auto" }} onClick={() => onOpen(id)}>
            Open
          </button>
        ) : null}
      </div>
      {note.state === "running" ? (
        <p className={s.noteText}>Dime is writing it…</p>
      ) : failed ? (
        <p className={`${s.noteText} ${s.failed}`}>{failed}</p>
      ) : line ? (
        <p className={s.noteText}>{line}</p>
      ) : null}
    </div>
  );
}
