"use client";

import { memo, useState } from "react";
import { MessageSquarePlus, ThumbsDown, ThumbsUp } from "lucide-react";
import { prose } from "@/lib/ai-prose";
import type { LivePart, LiveTurn } from "@/hooks/useAi";
import type { AiFeedback, AiPart, AiTurn } from "@/types/ai";
import dk from "@/components/desk/desk.module.css";
import { ChartBlock, TableBlock } from "./Blocks";
import { ProposalChip, type ChipActions } from "./Chips";
import s from "./ai.module.css";

/** What a failed turn's code means to the user, where the server's own message isn't enough. */
const OUTCOME_COPY: Record<string, string> = {
  AI_TIMEOUT: "The assistant took too long and stopped. Try a narrower question.",
  AI_DECLINED: "The assistant couldn't help with that one.",
  AI_INCOMPLETE: "The answer was cut off. Try a narrower question.",
  AI_BUSY: "The assistant is busy. Try again in a minute.",
};

/** Save a note; resolves true when it was stored. */
type OnComment = (turnId: number, text: string | null) => Promise<boolean>;

export function Thread({
  turns,
  live,
  chips,
  onVote,
  onComment,
}: {
  turns: AiTurn[];
  /** The turn streaming now (or just finished), until the stored copy replaces it. */
  live: LiveTurn | null;
  /** The chips' staging and dismissal (the tray under the thread sends them). */
  chips: ChipActions;
  onVote: (turnId: number, feedback: AiFeedback | null) => void;
  onComment: OnComment;
}) {
  return (
    <>
      {turns.map((t) => (
        <StoredTurn key={t.id} turn={t} chips={chips} onVote={onVote} onComment={onComment} />
      ))}
      {live ? <Live turn={live} chips={chips} /> : null}
    </>
  );
}

const StoredTurn = memo(function StoredTurn({
  turn,
  chips,
  onVote,
  onComment,
}: {
  turn: AiTurn;
  chips: ChipActions;
  onVote: (turnId: number, f: AiFeedback | null) => void;
  onComment: OnComment;
}) {
  const ok = turn.outcome === "ok";
  const [editing, setEditing] = useState(false);
  return (
    <section className={s.turn} aria-label="Question and answer">
      <div className={s.ask}>{turn.message}</div>
      <div className={s.answer}>
        <Parts parts={turn.parts} chips={chips} />
        {!ok ? <div className={s.failed}>{OUTCOME_COPY[turn.outcome] ?? "This answer didn't finish."}</div> : null}
        <div className={s.foot}>
          {ok ? <Vote turn={turn} onVote={onVote} /> : null}
          {!editing ? (
            <button type="button" className={s.vote} aria-label={turn.comment ? "Edit your note" : "Add a note"} title={turn.comment ? "Edit your note" : "Add a note on this answer"} onClick={() => setEditing(true)}>
              <MessageSquarePlus size={13} />
            </button>
          ) : null}
          {ok ? (
            <span className={dk.sub} style={{ marginLeft: 6 }} title="What this answer cost">
              {formatCost(turn.cost_usd)}
            </span>
          ) : null}
        </div>
        {editing ? (
          <NoteEditor
            initial={turn.comment ?? ""}
            onCancel={() => setEditing(false)}
            onSave={async (text) => {
              if (await onComment(turn.id, text.trim() ? text.trim() : null)) setEditing(false);
            }}
          />
        ) : turn.comment ? (
          <button type="button" className={s.note} onClick={() => setEditing(true)} title="Edit your note">
            <span className={dk.label}>Your note</span>
            <span className={s.noteText}>{turn.comment}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
});

/** A note on an answer: what was wrong, what you expected. ⌘⏎ saves, Esc cancels. */
function NoteEditor({ initial, onSave, onCancel }: { initial: string; onSave: (text: string) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await onSave(text);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={s.noteEditor}>
      <textarea
        className={s.noteInput}
        value={text}
        autoFocus
        rows={3}
        maxLength={2000}
        placeholder="What was wrong or missing? Notes are for reviewing answers later."
        aria-label="Your note on this answer"
        onChange={(e) => setText(e.target.value)}
        readOnly={saving}
        aria-busy={saving}
        onKeyDown={(e) => {
          // No shortcuts while a save is in flight (a second write could land out of order),
          // and none while an IME is composing (Escape dismisses the candidate, not the editor)
          if (saving || e.nativeEvent.isComposing) return;
          if (e.key === "Escape") onCancel();
          else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void save();
          }
        }}
      />
      <div className={s.noteActions}>
        <span className={dk.sub}>⌘⏎ save · Esc cancel</span>
        <span className={dk.spacer} />
        <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className={`${dk.btn} ${dk.btnSmall} ${dk.btnPrimary}`} onClick={() => void save()} disabled={saving || text.trim() === initial.trim()}>
          {initial && !text.trim() ? "Remove note" : "Save note"}
        </button>
      </div>
    </div>
  );
}

function Live({ turn, chips }: { turn: LiveTurn; chips: ChipActions }) {
  const writing = turn.phase === "sending" || turn.phase === "streaming";
  const lastText = turn.parts[turn.parts.length - 1]?.kind === "text";
  return (
    <section className={s.turn} aria-label="Question and answer" aria-busy={writing}>
      <div className={s.ask}>{turn.message}</div>
      <div className={s.answer} aria-live="polite">
        <Parts parts={turn.parts} chips={chips} caret={writing && lastText && !turn.status} />
        {writing && turn.status ? (
          <div className={s.status}>
            <span className={s.statusDot} aria-hidden />
            <span>{turn.status}…</span>
          </div>
        ) : null}
        {turn.error ? <div className={s.failed}>{OUTCOME_COPY[turn.error.code] ?? turn.error.message}</div> : null}
        {turn.done && turn.phase === "done" ? (
          <div className={s.foot}>
            <span className={dk.sub}>{formatCost(turn.done.cost_usd)}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Parts({ parts, chips, caret = false }: { parts: Array<AiPart | LivePart>; chips: ChipActions; caret?: boolean }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <Prose key={i} text={p.text} caret={caret && i === parts.length - 1} />
        ) : p.block.type === "proposal" ? (
          <ProposalChip key={`${p.block.id}-${i}`} chip={p.block} actions={chips} />
        ) : p.block.type === "chart" ? (
          <ChartBlock key={`${p.block.id}-${i}`} chart={p.block} />
        ) : (
          <TableBlock key={`${p.block.id}-${i}`} table={p.block} />
        )
      )}
    </>
  );
}

function Prose({ text, caret }: { text: string; caret: boolean }) {
  const blocks = prose(text);
  if (!blocks.length && !caret) return null;
  return (
    <div className={s.prose}>
      {blocks.map((b, i) => {
        const tail = caret && i === blocks.length - 1 ? <span className={s.caret} aria-hidden /> : null;
        if (b.kind === "p") {
          return (
            <p key={i}>
              {b.spans.map((sp, j) => (sp.bold ? <strong key={j}>{sp.text}</strong> : <span key={j}>{sp.text}</span>))}
              {tail}
            </p>
          );
        }
        return (
          <ul key={i}>
            {b.items.map((item, j) => (
              <li key={j}>
                {item.map((sp, k) => (sp.bold ? <strong key={k}>{sp.text}</strong> : <span key={k}>{sp.text}</span>))}
                {j === b.items.length - 1 ? tail : null}
              </li>
            ))}
          </ul>
        );
      })}
      {!blocks.length && caret ? <span className={s.caret} aria-hidden /> : null}
    </div>
  );
}

function formatCost(usd: number): string {
  if (usd <= 0) return "";
  return usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`;
}

function Vote({ turn, onVote }: { turn: AiTurn; onVote: (turnId: number, f: AiFeedback | null) => void }) {
  const set = (f: AiFeedback) => onVote(turn.id, turn.feedback === f ? null : f);
  return (
    <>
      <button type="button" className={s.vote} aria-pressed={turn.feedback === "up"} aria-label="Good answer" title="Good answer" onClick={() => set("up")}>
        <ThumbsUp size={13} />
      </button>
      <button type="button" className={s.vote} aria-pressed={turn.feedback === "down"} aria-label="Bad answer" title="Bad answer" onClick={() => set("down")}>
        <ThumbsDown size={13} />
      </button>
    </>
  );
}
