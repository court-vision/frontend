/**
 * The command palette's matching: which of its commands a typed query keeps,
 * best first. Pure, so the palette's own entries (the desks, your teams, the
 * themes, the desk's commands) are matched and tested here; players and NBA
 * teams are matched by the Scout helpers they already have.
 */
import { fold } from "@/lib/scout";

/** What a command is matched on; the palette adds what it does. */
export interface PaletteEntry {
  label: string;
  /** One line under the label. */
  note?: string;
  group: string;
  keywords?: readonly string[];
}

/** "Teams and connections…" → ["teams", "and", "connections"]: folded, split on space and punctuation. */
function words(s: string): string[] {
  return fold(s)
    .split(/[\s·…/,.()-]+/)
    .filter(Boolean);
}

/**
 * How well an entry answers the query's tokens, lower is better: 0 when the
 * label starts with it, 1 a later word of the label, 2 a keyword, the note
 * or the group, 3 somewhere inside the label (two characters or more, so one
 * letter does not light up everything). -1 when a token matches nothing.
 */
function score(tokens: readonly string[], e: PaletteEntry): number {
  const label = fold(e.label);
  const labelWords = words(e.label);
  const extra = [...(e.keywords ?? []), e.note ?? "", e.group].flatMap(words);
  let total = 0;
  for (const t of tokens) {
    if (label.startsWith(t)) total += 0;
    else if (labelWords.some((w) => w.startsWith(t))) total += 1;
    else if (extra.some((w) => w.startsWith(t))) total += 2;
    else if (t.length >= 2 && label.includes(t)) total += 3;
    else return -1;
  }
  return total;
}

/** An entry the query kept, and how well it matched (0 when the query is blank). */
export interface PaletteMatch<E extends PaletteEntry> {
  entry: E;
  score: number;
}

/**
 * The entries the query keeps, best match first and otherwise in the order
 * given; every entry, in order, when the query is blank. Every word of the
 * query has to match somewhere ("matchup week" keeps Week, "week matchup"
 * too), accents aside ("jokic" finds Jokić).
 */
export function matchCommands<E extends PaletteEntry>(q: string, entries: readonly E[]): E[] {
  return scoreCommands(q, entries).map((m) => m.entry);
}

function scoreCommands<E extends PaletteEntry>(q: string, entries: readonly E[]): PaletteMatch<E>[] {
  const tokens = fold(q).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return entries.map((entry) => ({ entry, score: 0 }));
  return entries
    .map((e, i) => ({ e, i, s: score(tokens, e) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => ({ entry: x.e, score: x.s }));
}

/** A group of the palette's list: its heading, what is in it, and its best match's score. */
export interface PaletteGroup<E extends PaletteEntry> {
  group: string;
  entries: E[];
  best: number;
}

/**
 * The matched entries by group, groups with nothing left out. With a blank
 * query the groups come in `order` (a group `order` does not name goes last).
 * With a query they come by their best match, so what you typed the name of
 * is on top whatever its group; ties keep `order`.
 */
export function groupMatches<E extends PaletteEntry>(q: string, entries: readonly E[], order: readonly string[]): PaletteGroup<E>[] {
  const groups = new Map<string, PaletteGroup<E>>();
  for (const { entry, score } of scoreCommands(q, entries)) {
    const g = groups.get(entry.group);
    if (g) g.entries.push(entry);
    else groups.set(entry.group, { group: entry.group, entries: [entry], best: score });
  }
  const rank = (g: string) => {
    const i = order.indexOf(g);
    return i === -1 ? order.length : i;
  };
  return [...groups.values()].sort((a, b) => a.best - b.best || rank(a.group) - rank(b.group));
}
