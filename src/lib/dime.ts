/**
 * The AI desk's views of Dime's notebook and the move ledger: how a note's
 * kind, author and recheck read, and how a move's windows are summed up.
 * Pure, so the views stay simple and this stays tested.
 */
import type { AiNote, AiNoteKind, MoveOutcome, MoveSide, MoveSource, MoveSourceSummary, MoveWindow, MoveWindowName } from "@/types/ai";

export const NOTE_KINDS: Array<{ id: AiNoteKind; label: string }> = [
  { id: "preference", label: "Preference" },
  { id: "plan", label: "Plan" },
  { id: "player", label: "Player" },
  { id: "league", label: "League" },
  { id: "opponent", label: "Opponent" },
  { id: "lesson", label: "Lesson" },
  { id: "note", label: "Note" },
];

export const NOTE_MAX = 500;

export function kindLabel(kind: AiNoteKind): string {
  return NOTE_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

/** A note is due once its recheck day has come (`today` is YYYY-MM-DD). */
export function isDue(note: Pick<AiNote, "recheck_on" | "retired_on">, today: string): boolean {
  return note.retired_on == null && note.recheck_on != null && note.recheck_on <= today;
}

/** Who retired a note and how: "Revised by Dime", "Forgotten by you: stale". */
export function retiredLabel(note: Pick<AiNote, "retired_by" | "retired_reason">): string {
  const who = note.retired_by === "user" ? "you" : "Dime";
  if (note.retired_reason === "revised") return `Revised by ${who}`;
  if (note.retired_by === "user") return "Deleted by you";
  return note.retired_reason ? `Forgotten by Dime: ${note.retired_reason}` : "Forgotten by Dime";
}

/** Notes in groups: about the user first, then each team in the order given; live before retired. */
export function groupNotes(notes: AiNote[], teamOrder: number[]): Array<{ teamId: number | null; notes: AiNote[] }> {
  const groups = new Map<number | null, AiNote[]>();
  for (const n of notes) {
    const key = n.team_id ?? null;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const rank = (id: number | null) => (id == null ? -1 : teamOrder.indexOf(id) === -1 ? teamOrder.length : teamOrder.indexOf(id));
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || (a ?? 0) - (b ?? 0))
    .map(([teamId, list]) => ({
      teamId,
      notes: [...list].sort((x, y) => Number(x.retired_on != null) - Number(y.retired_on != null)),
    }));
}

// ---- the move ledger

export const SOURCE_LABELS: Record<MoveSource, string> = {
  dime: "Dime",
  lane: "Stream lane",
  scheduled: "Scheduled",
  you: "You",
  outside: "Outside",
};

export const WINDOW_LABELS: Record<MoveWindowName, string> = {
  day: "Day",
  matchup: "Matchup",
  two_weeks: "2 weeks",
};

export function windowOf(move: Pick<MoveOutcome, "windows">, name: MoveWindowName): MoveWindow | null {
  const w = move.windows?.[name];
  return w && typeof w === "object" ? (w as MoveWindow) : null;
}

export function signed(value: number, digits = 1): string {
  const text = Math.abs(value).toFixed(digits);
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text;
}

export type Tone = "up" | "down" | "flat";

export function toneOf(value: number | null | undefined): Tone {
  if (value == null || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

/** A window in one cell: its net in points, or its categories won and lost; null when it has neither. */
export function windowResult(w: MoveWindow | null): { text: string; tone: Tone } | null {
  if (!w) return null;
  if (typeof w.net === "number") return { text: signed(w.net), tone: toneOf(w.net) };
  if (w.edge) {
    const won = w.edge.won.length;
    const lost = w.edge.lost.length;
    return { text: `${won}–${lost}`, tone: toneOf(won - lost) };
  }
  return null;
}

/** "12.5 pts in 3 games, 2 started here" for a side; categories name the games only. */
export function sideText(side: MoveSide | null, startedHere = false): string {
  if (!side) return "";
  const games = `${side.games} ${side.games === 1 ? "game" : "games"}`;
  const pts = typeof side.points === "number" ? `${side.points.toFixed(1)} pts in ` : "";
  const started = startedHere && side.counted_games != null ? `, ${side.counted_games} started here` : "";
  return `${pts}${games}${started}`;
}

/** One source's line in the summary: "3 moves, 2 settled: +14.5 (2 ahead, 0 behind)". */
export function summaryText(s: MoveSourceSummary): string {
  const moves = `${s.moves} ${s.moves === 1 ? "move" : "moves"}`;
  if (s.settled === 0) return `${moves}, none settled yet`;
  const settled = `${s.settled} settled`;
  if (s.net_points != null) return `${moves}, ${settled}: ${signed(s.net_points)} (${s.ahead ?? 0} ahead, ${s.behind ?? 0} behind)`;
  if (s.categories_won != null) return `${moves}, ${settled}: ${s.categories_won}–${s.categories_lost ?? 0} in categories`;
  return `${moves}, ${settled}`;
}

/** A Dime proposal's forecast beside its result: the projected change it was sent on. */
export function forecastChange(move: Pick<MoveOutcome, "forecast">): number | null {
  const change = move.forecast?.change;
  return typeof change === "number" ? change : null;
}
