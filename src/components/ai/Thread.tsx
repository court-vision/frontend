"use client";

import { memo, useState } from "react";
import { MessageSquarePlus, ThumbsDown, ThumbsUp } from "lucide-react";
import { prose } from "@/lib/ai-prose";
import type { LivePart, LiveTurn } from "@/hooks/useAi";
import type { AiFeedback, AiPart, AiTable, AiTurn } from "@/types/ai";
import dk from "@/components/desk/desk.module.css";
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
  onVote,
  onComment,
}: {
  turns: AiTurn[];
  /** The turn streaming now (or just finished), until the stored copy replaces it. */
  live: LiveTurn | null;
  onVote: (turnId: number, feedback: AiFeedback | null) => void;
  onComment: OnComment;
}) {
  return (
    <>
      {turns.map((t) => (
        <StoredTurn key={t.id} turn={t} onVote={onVote} onComment={onComment} />
      ))}
      {live ? <Live turn={live} /> : null}
    </>
  );
}

const StoredTurn = memo(function StoredTurn({
  turn,
  onVote,
  onComment,
}: {
  turn: AiTurn;
  onVote: (turnId: number, f: AiFeedback | null) => void;
  onComment: OnComment;
}) {
  const ok = turn.outcome === "ok";
  const [editing, setEditing] = useState(false);
  return (
    <section className={s.turn} aria-label="Question and answer">
      <div className={s.ask}>{turn.message}</div>
      <div className={s.answer}>
        <Parts parts={turn.parts} />
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

function Live({ turn }: { turn: LiveTurn }) {
  const writing = turn.phase === "sending" || turn.phase === "streaming";
  const lastText = turn.parts[turn.parts.length - 1]?.kind === "text";
  return (
    <section className={s.turn} aria-label="Question and answer" aria-busy={writing}>
      <div className={s.ask}>{turn.message}</div>
      <div className={s.answer} aria-live="polite">
        <Parts parts={turn.parts} caret={writing && lastText && !turn.status} />
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

function Parts({ parts, caret = false }: { parts: Array<AiPart | LivePart>; caret?: boolean }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <Prose key={i} text={p.text} caret={caret && i === parts.length - 1} />
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

/** Where a lookup's table came from, in words. */
const SOURCES: Record<string, string> = {
  get_free_agents: "free agents",
  get_matchup: "your matchup",
  get_game_log: "box scores",
  get_player_stats: "player stats",
  get_scheduled_pickups: "scheduled pickups",
  get_projections: "projections",
  get_draft_market: "the draft market",
  get_market_movement: "draft market moves",
  get_schedule: "the schedule",
  get_draft_room: "your draft room",
  get_draft_rooms: "your draft rooms",
  search_players: "player search",
};

function TableBlock({ table }: { table: AiTable }) {
  // A column is numeric when every value in it is a number (or empty)
  const numeric = table.columns.map((_, c) => table.rows.some((r) => typeof r[c] === "number") && table.rows.every((r) => r[c] == null || typeof r[c] === "number"));
  const from = table.tools.map((t) => SOURCES[t] ?? t).join(", ");
  const cut = table.total_rows > table.rows.length ? ` · ${table.rows.length} of ${table.total_rows}` : "";
  return (
    <figure className={s.tableBox} style={{ margin: 0 }}>
      <figcaption className={s.tableTitle}>
        <span>{table.title}</span>
        <span className={dk.sub} style={{ fontWeight: 400 }}>
          from {from}
          {cut}
        </span>
      </figcaption>
      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead>
            <tr>
              {table.columns.map((c, i) => (
                <th key={c.key} className={numeric[i] ? s.num : undefined} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, i) => (
                  <td key={i} className={numeric[i] ? s.num : undefined}>
                    {cell == null || cell === "" ? <span className={s.nil}>—</span> : formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function formatCell(cell: unknown): string {
  if (typeof cell === "boolean") return cell ? "Yes" : "No";
  if (typeof cell === "number") return Number.isInteger(cell) ? String(cell) : String(Math.round(cell * 100) / 100);
  return String(cell);
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
