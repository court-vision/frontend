"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeskDialog } from "@/components/desk/DeskDialog";
import type { DeskTeam } from "@/components/desk/TeamSwitch";
import { aiMessage, useAiNotesQuery, useCreateAiNote, useDeleteAiNote, useEditAiNote } from "@/hooks/useAi";
import { groupNotes, isDue, kindLabel, NOTE_KINDS, NOTE_MAX, retiredLabel } from "@/lib/dime";
import type { AiNote, AiNoteKind } from "@/types/ai";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/** Today in ET as YYYY-MM-DD, the day a recheck falls due on. */
function todayEt(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * "What Dime knows": the notes the agent keeps between conversations, about the
 * user and on each team. The user can add their own (Dime follows them and
 * can't change them), edit any (an edit makes the note the user's), and delete
 * any. Retired notes stay readable with who retired them.
 */
export function DimeNotesDialog({
  open,
  onOpenChange,
  teams,
  teamId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: DeskTeam[];
  teamId: number | null;
}) {
  const [showRetired, setShowRetired] = useState(false);
  const notes = useAiNotesQuery(open, showRetired);
  const today = todayEt();
  const groups = useMemo(() => groupNotes(notes.data ?? [], teams.map((t) => t.id)), [notes.data, teams]);
  const teamLabel = (id: number | null) => (id == null ? "About you" : (teams.find((t) => t.id === id)?.name ?? `Team ${id}`));
  const live = (notes.data ?? []).filter((n) => n.retired_on == null).length;

  return (
    <DeskDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="What Dime knows"
      description="Notes Dime keeps between conversations: your plans, its reads on players and your league, and lessons from how moves went. Your own notes outrank its own: Dime follows them and can't change them. Editing one of Dime's makes it yours."
      cancelLabel="Close"
    >
      <NoteForm teams={teams} teamId={teamId} />
      <div className={s.noteBar}>
        <span className={dk.label}>{notes.isLoading ? "Notes" : `${live} live ${live === 1 ? "note" : "notes"}`}</span>
        <span className={dk.spacer} />
        <label className={s.check}>
          <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
          Show retired
        </label>
      </div>
      {notes.isLoading ? (
        <div className={s.noteList} aria-busy>
          <span className={dk.skel} style={{ width: "80%" }} />
          <span className={dk.skel} style={{ width: "60%" }} />
        </div>
      ) : notes.isError ? (
        <div className={s.rowEmpty}>{aiMessage(notes.error, "Couldn't read the notes")}</div>
      ) : groups.length === 0 ? (
        <div className={s.rowEmpty}>Nothing yet. Dime writes notes as you talk, and you can add your own above.</div>
      ) : (
        <div className={s.noteList}>
          {groups.map((g) => (
            <section key={g.teamId ?? "you"} className={s.noteGroup} aria-label={teamLabel(g.teamId)}>
              <span className={dk.label}>{teamLabel(g.teamId)}</span>
              {g.notes.map((n) => (
                <NoteRow key={n.note_id} note={n} due={isDue(n, today)} />
              ))}
            </section>
          ))}
        </div>
      )}
    </DeskDialog>
  );
}

function NoteForm({ teams, teamId }: { teams: DeskTeam[]; teamId: number | null }) {
  const [kind, setKind] = useState<AiNoteKind>("preference");
  const [about, setAbout] = useState<string>(teamId != null ? String(teamId) : "");
  const [recheck, setRecheck] = useState("");
  const [text, setText] = useState("");
  const create = useCreateAiNote();
  const clean = text.trim();

  const submit = () => {
    if (!clean || create.isPending) return;
    create.mutate(
      { kind, text: clean, team_id: about ? Number(about) : null, recheck_on: recheck || null },
      {
        onSuccess: () => {
          setText("");
          setRecheck("");
        },
        onError: (err) => toast.error(aiMessage(err, "Couldn't save the note")),
      }
    );
  };

  return (
    <form
      className={s.noteForm}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        className={s.textarea}
        aria-label="Your note for Dime"
        placeholder="Tell Dime something to keep, e.g. Never drop my rookies before December."
        value={text}
        maxLength={NOTE_MAX}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className={s.noteFormRow}>
        <select className={s.select} aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value as AiNoteKind)}>
          {NOTE_KINDS.filter((k) => k.id !== "lesson").map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <select className={s.select} aria-label="About" value={about} onChange={(e) => setAbout(e.target.value)}>
          <option value="">About you</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label className={s.dateField}>
          <span className={dk.sub}>Recheck</span>
          <input type="date" className={`${dk.input} ${s.dateInput}`} aria-label="Recheck on" value={recheck} min={todayEt()} onChange={(e) => setRecheck(e.target.value)} />
        </label>
        <span className={dk.spacer} />
        <button type="submit" className={`${dk.btn} ${dk.btnPrimary} ${dk.btnSmall}`} disabled={!clean || create.isPending}>
          {create.isPending ? <Loader2 size={13} className={dk.spin} /> : <Plus size={13} />} Add
        </button>
      </div>
    </form>
  );
}

function NoteRow({ note, due }: { note: AiNote; due: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const edit = useEditAiNote();
  const remove = useDeleteAiNote();
  const retired = note.retired_on != null;
  const busy = edit.isPending || remove.isPending;

  const save = () => {
    // Cmd/Ctrl+Enter can fire while the first save is in flight; a second PATCH
    // would hit the note the first one just replaced and report a failure.
    if (edit.isPending) return;
    const clean = draft.trim();
    if (!clean || clean === note.text) {
      setEditing(false);
      return;
    }
    edit.mutate(
      { noteId: note.note_id, edit: { text: clean } },
      { onSuccess: () => setEditing(false), onError: (err) => toast.error(aiMessage(err, "Couldn't save the note")) }
    );
  };

  return (
    <div className={s.noteRow} data-retired={retired || undefined}>
      <div className={s.noteHead}>
        <span className={dk.badge}>{kindLabel(note.kind)}</span>
        <span className={s.noteAuthor} data-author={note.author}>
          {note.author === "user" ? "You" : "Dime"}
        </span>
        <span className={dk.sub}>
          {shortDate(note.written_on)}
          {note.recheck_on ? ` · recheck ${shortDate(note.recheck_on)}` : ""}
        </span>
        {due ? <span className={`${dk.chip} ${dk.warnChip}`}>due</span> : null}
        <span className={dk.spacer} />
        {!retired && !editing ? (
          <>
            <button
              type="button"
              className={dk.iconBtn}
              aria-label="Edit this note"
              title="Edit"
              disabled={busy}
              onClick={() => {
                setDraft(note.text);
                setEditing(true);
              }}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className={dk.iconBtn}
              aria-label="Delete this note"
              title="Delete"
              disabled={busy}
              onClick={() => remove.mutate(note.note_id, { onError: (err) => toast.error(aiMessage(err, "Couldn't delete it")) })}
            >
              {remove.isPending ? <Loader2 size={13} className={dk.spin} /> : <Trash2 size={13} />}
            </button>
          </>
        ) : null}
      </div>
      {editing ? (
        <div className={s.noteEdit}>
          <textarea
            className={s.textarea}
            aria-label="Edit the note"
            value={draft}
            maxLength={NOTE_MAX}
            rows={3}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                e.stopPropagation();
                setEditing(false);
              }
            }}
          />
          <div className={s.noteFormRow}>
            <span className={dk.sub}>{note.author === "dime" ? "Saving makes this note yours." : ""}</span>
            <span className={dk.spacer} />
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => setEditing(false)} disabled={edit.isPending}>
              Cancel
            </button>
            <button type="button" className={`${dk.btn} ${dk.btnPrimary} ${dk.btnSmall}`} onClick={save} disabled={edit.isPending || !draft.trim()}>
              {edit.isPending ? <Loader2 size={13} className={dk.spin} /> : null} Save
            </button>
          </div>
        </div>
      ) : (
        <p className={s.noteText}>{note.text}</p>
      )}
      {retired ? <span className={dk.sub}>{retiredLabel(note)}</span> : null}
    </div>
  );
}
