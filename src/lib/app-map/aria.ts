/**
 * Reading a page the way the app map does (docs/APP_MAP_PLAN.md): from
 * Playwright's accessibility snapshot, the roles and names a user and a screen
 * reader get. Pure, so the crawler (scripts/app-map.ts) and its tests share it.
 *
 * - `parseSnapshot` turns `locator.ariaSnapshot()`'s YAML into a tree;
 * - `prune` keeps two of a list's items and counts the rest, so one row of a
 *   player list stands for all of them;
 * - `controlsOf` is what the crawler clicks, `fingerprint` how it tells one
 *   screen from another, and `fresh` what a click added.
 */

export interface AriaNode {
  role: string;
  name?: string;
  /** `[checked]`, `[level=2]`, `[disabled]`…: true when the attribute has no value. */
  attrs: Record<string, string | true>;
  /** The text after the colon: a `text` node's text, or an element's own text. */
  value?: string;
  /** `/url`, `/placeholder`. */
  props: Record<string, string>;
  children: AriaNode[];
  /** Set by `prune`: how many more items like this one were left out after it. */
  more?: number;
}

/** A YAML scalar as the snapshot writes it: plain, 'single' ('' for a quote) or "double" (JSON escapes). */
function scalar(s: string): { text: string; rest: string } {
  if (s.startsWith("'")) {
    let out = "";
    for (let i = 1; i < s.length; i++) {
      if (s[i] === "'") {
        if (s[i + 1] === "'") {
          out += "'";
          i++;
        } else return { text: out, rest: s.slice(i + 1) };
      } else out += s[i];
    }
    return { text: out, rest: "" };
  }
  if (s.startsWith('"')) {
    for (let i = 1; i < s.length; i++) {
      if (s[i] === "\\") i++;
      else if (s[i] === '"') {
        try {
          return { text: JSON.parse(s.slice(0, i + 1)), rest: s.slice(i + 1) };
        } catch {
          return { text: s.slice(1, i), rest: s.slice(i + 1) };
        }
      }
    }
    return { text: s.slice(1), rest: "" };
  }
  // Plain: the key runs to the first ": " outside the name's quotes, or to a trailing ":"
  let inName = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && inName) i++;
    else if (s[i] === '"') inName = !inName;
    else if (!inName && s[i] === ":" && (i === s.length - 1 || s[i + 1] === " ")) return { text: s.slice(0, i), rest: s.slice(i) };
  }
  return { text: s, rest: "" };
}

/** `button "Market P" [pressed]` → role, name, attributes. */
function parseKey(key: string): Pick<AriaNode, "role" | "name" | "attrs"> {
  const m = key.match(/^([a-z]+)\s*/i);
  const role = m ? m[1] : key;
  let rest = key.slice(m ? m[0].length : key.length);
  let name: string | undefined;
  if (rest.startsWith('"')) {
    const q = scalar(rest);
    name = q.text;
    rest = q.rest;
  }
  const attrs: Record<string, string | true> = {};
  for (const a of rest.matchAll(/\[([a-z-]+)(?:=([^\]]*))?\]/gi)) attrs[a[1]] = a[2] ?? true;
  return { role, name, attrs };
}

/** The snapshot's YAML as a tree. Lines it can't read are skipped, never thrown. */
export function parseSnapshot(yaml: string): AriaNode[] {
  const root: AriaNode = { role: "root", attrs: {}, props: {}, children: [] };
  const stack: { indent: number; node: AriaNode }[] = [{ indent: -1, node: root }];
  for (const line of yaml.split("\n")) {
    const m = line.match(/^(\s*)- (.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    const { text: key, rest } = scalar(m[2]);
    let value: string | undefined;
    const after = rest.replace(/^:\s?/, "");
    if (rest.startsWith(":") && after.trim()) value = after.startsWith("'") || after.startsWith('"') ? scalar(after).text : after;
    if (key.startsWith("/")) {
      parent.props[key.slice(1)] = value ?? "";
      continue;
    }
    const node: AriaNode = { ...parseKey(key), props: {}, children: [] };
    if (value !== undefined) node.value = value;
    parent.children.push(node);
    stack.push({ indent, node });
  }
  return root.children;
}

/** What a user can act on: the crawler clicks these (links it records instead). */
export const CLICKABLE = new Set([
  "button", "link", "tab", "radio", "checkbox", "switch", "menuitem", "menuitemradio",
  "menuitemcheckbox", "option", "combobox", "treeitem",
]);
/** Typed into, not clicked: the crawler types in the ones that search (`searchable`) and records the rest. */
export const INPUTS = new Set(["textbox", "searchbox", "slider", "spinbutton"]);
/** Items of a list: past the first two named by data, one more stands for nothing new. */
const ITEM_ROLES = new Set(["row", "option", "listitem", "article", "treeitem"]);
/** Choices that are the UI itself, however alike they look: never collapsed. */
const CHOICE_ROLES = new Set(["radio", "tab", "menuitem", "menuitemradio", "menuitemcheckbox"]);
const KEEP = 2;

/** Whether a string is the app's own words (from the source sweep) rather than data. */
export type IsChrome = (s: string) => boolean;

/**
 * Children with repeated items left out: the first two of each list role
 * (rows, options, list items) and of each role of control whose names are
 * data (players, teams, games), and of each run of identical leaves ("away",
 * "home" under every game). A list whose items are mostly named in the
 * app's own words ("Adds", "Drops", "Draft market") is choices, each kept.
 * Each kept child comes with
 * the count of like items left out after it. The input is not changed.
 */
function collapse(children: AriaNode[], isChrome: IsChrome): { node: AriaNode; more: number }[] {
  // A list is data when most of its items are: "L. Black WAS F" is a player among players, whatever its words
  const votes = new Map<string, number>();
  for (const c of children) {
    const label = c.name ?? c.value;
    if (ITEM_ROLES.has(c.role)) votes.set(c.role, (votes.get(c.role) ?? 0) + (label && isChrome(label) ? -1 : 1));
  }
  const seen = new Map<string, number>();
  const last = new Map<string, { node: AriaNode; more: number }>();
  const out: { node: AriaNode; more: number }[] = [];
  for (const c of children) {
    let group: string | null = null;
    if (ITEM_ROLES.has(c.role) && (votes.get(c.role) ?? 0) >= 0) group = `item:${c.role}`;
    else if (!CHOICE_ROLES.has(c.role) && (CLICKABLE.has(c.role) || c.role === "group") && c.name && !isChrome(c.name)) group = `data:${c.role}`;
    else if (c.children.length === 0) group = rowLike(c) ?? `same:${normalize(nodeLine(c))}`;
    const entry = { node: c, more: 0 };
    if (group) {
      const n = (seen.get(group) ?? 0) + 1;
      seen.set(group, n);
      if (n > KEEP) {
        last.get(group)!.more++;
        continue;
      }
      last.set(group, entry);
    }
    out.push(entry);
  }
  return out;
}

/**
 * A line of text that is a table row in all but role (the draft board's
 * players: `131 Jrue Holiday POR · PG 14.0 149 142 …`): four numbers or more,
 * grouped by how many, so a board of them is one list.
 */
function rowLike(n: AriaNode): string | null {
  const text = n.value ?? n.name ?? "";
  const numbers = text.match(/[-+−]?\d+(?:[.,:/]\d+)*%?/g)?.length ?? 0;
  return numbers >= 4 ? `row-like:${n.role}:${numbers}` : null;
}

/** The tree with repeated items collapsed, all the way down, as new nodes. */
export function prune(nodes: AriaNode[], isChrome: IsChrome): AriaNode[] {
  return collapse(nodes, isChrome).map(({ node, more }) => {
    const out: AriaNode = { ...node, children: prune(node.children, isChrome) };
    if (more) out.more = more;
    else delete out.more;
    return out;
  });
}

/** The original nodes `prune` keeps. */
function kept(nodes: AriaNode[], isChrome: IsChrome, into = new Set<AriaNode>()): Set<AriaNode> {
  for (const { node } of collapse(nodes, isChrome)) {
    into.add(node);
    kept(node.children, isChrome, into);
  }
  return into;
}

const MAX_LINE = 200;
const cap = (s: string) => (s.length > MAX_LINE ? `${s.slice(0, MAX_LINE)}…` : s);

/** One node as a line: `button "Market P" [pressed]: text`. */
export function nodeLine(n: AriaNode): string {
  const attrs = Object.entries(n.attrs)
    .map(([k, v]) => (v === true ? ` [${k}]` : ` [${k}=${v}]`))
    .join("");
  const name = n.name !== undefined ? ` ${JSON.stringify(n.name)}` : "";
  return cap(`${n.role}${name}${attrs}${n.value !== undefined ? `: ${n.value}` : ""}`);
}

/** The tree as indented lines, the shape the agent reads. */
export function render(nodes: AriaNode[], depth = 0): string[] {
  const pad = "  ".repeat(depth);
  const out: string[] = [];
  for (const n of nodes) {
    out.push(`${pad}- ${nodeLine(n)}`);
    for (const [k, v] of Object.entries(n.props)) out.push(`${pad}  - /${k}: ${v}`);
    out.push(...render(n.children, depth + 1));
    if (n.more) out.push(`${pad}- (… ${n.more} more like the above)`);
  }
  return out;
}

/** A control the crawler can find again: role, name, and which of that role and name it is. */
export interface Control {
  role: string;
  name: string;
  nth: number;
  disabled: boolean;
  href?: string;
  /** Its name is data (a player, a team), so it is one example of many. */
  example: boolean;
  /** The name of the region, list or dialog it sits in, or the landmark's role ("main"). */
  within?: string;
}

/** An input the crawler types a name into, to see what a search opens. */
export const searchable = (c: Pick<Control, "role" | "name">) =>
  c.role === "searchbox" || ((c.role === "combobox" || c.role === "textbox") && /\b(search|find|filter|look up)\b/i.test(c.name));

/**
 * The controls on a page, in order, from the pruned tree, so a list's third
 * row and on are never clicked, nor a third control of one role and name;
 * with `only`, just those among those nodes
 * (what a click revealed). `nth` counts among the whole page's controls of
 * that role and name, the way `getByRole(role, { name, exact }).nth()` does,
 * so the crawler can find each one again.
 */
export function controlsOf(nodes: AriaNode[], isChrome: IsChrome, only?: Set<AriaNode>): Control[] {
  const keep = kept(nodes, isChrome);
  const counts = new Map<string, number>();
  const out: Control[] = [];
  (function walk(ns: AriaNode[], within: string | undefined) {
    for (const n of ns) {
      if ((CLICKABLE.has(n.role) || INPUTS.has(n.role)) && n.name) {
        const key = `${n.role}|${n.name}`;
        const nth = counts.get(key) ?? 0;
        counts.set(key, nth + 1);
        // The same control a third time is the same action on another item ("Add to the canvas" per table)
        if (keep.has(n) && nth < KEEP && (!only || only.has(n))) {
          const c: Control = { role: n.role, name: n.name, nth, disabled: n.attrs.disabled === true, example: !isChrome(n.name) };
          if (n.props.url !== undefined) c.href = n.props.url;
          if (within) c.within = within;
          out.push(c);
        }
      }
      walk(n.children, STRUCTURE.has(n.role) && n.name ? n.name : !within && LANDMARKS.has(n.role) ? n.role : within);
    }
  })(nodes, undefined);
  return out;
}

/** Roles whose presence and name make a screen what it is. */
const STRUCTURE = new Set([
  "dialog", "alertdialog", "region", "complementary", "navigation", "main", "form", "search",
  "radiogroup", "tablist", "tabpanel", "listbox", "grid", "table", "treegrid", "menu", "menubar",
  "toolbar", "textbox", "searchbox", "combobox", "slider",
]);

/** Digits out, spaces folded: "Move 2 of 3" and "Move 1 of 3" are one control. */
export const normalize = (s: string) => s.replace(/\d+([.,:/]\d+)*/g, "#").replace(/\s+/g, " ").trim();

/** A name without its numbers and marks: "GP ▾" is "GP", "Move 2 of 3" is "Move # of #". */
const bare = (s: string) => normalize(s).replace(/[^\p{L}\p{N}#%' ]/gu, "").replace(/\s+/g, " ").trim();

/**
 * What a screen is, independent of its data: the path and the names of its
 * query params, its structural roles and their names, headings by level only,
 * and the names of its chrome controls, numbers and marks out. Thirty NBA team
 * sheets are one screen; the Market open and closed are two. Which choice is
 * picked (a sort, a theme, a stat window) doesn't make another screen, since
 * the screen already shows every choice; a disclosure's `expanded` does.
 */
export function structure(pathname: string, params: string[], nodes: AriaNode[], isChrome: IsChrome): string[] {
  const lines = new Set<string>([`${pathname}?${[...params].filter((p) => p !== "demo").sort().join("&")}`]);
  (function walk(ns: AriaNode[]) {
    for (const n of ns) {
      const state = n.attrs.expanded !== undefined ? `expanded=${n.attrs.expanded}` : "";
      if (n.role === "heading") lines.add(`heading ${n.attrs.level ?? ""}`);
      else if (STRUCTURE.has(n.role)) lines.add(`${n.role} ${bare(n.name ?? "")}`);
      else if (CLICKABLE.has(n.role) && n.name && isChrome(n.name)) lines.add(`${n.role} ${bare(n.name)}${state ? ` ${state}` : ""}`);
      walk(n.children);
    }
  })(nodes);
  return [...lines].sort();
}

/** Landmarks a page is made of: each shows its own state, whatever the others show. */
const LANDMARKS = new Set(["banner", "complementary", "main", "contentinfo", "navigation", "region", "dialog", "alertdialog", "form", "search"]);

/**
 * A page as its parts: each top-level landmark ("main", "complementary",
 * "dialog Theme"), and the rest of the page together, each with the hash of
 * its structure. A desk whose rail and focus change on their own (Scout's
 * lens and its player or team sheet) has as many screens as the parts have
 * states, not as many as their combinations: a screen is new only when one
 * of its parts is.
 */
export function parts(nodes: AriaNode[], isChrome: IsChrome): string[] {
  const groups = new Map<string, AriaNode[]>();
  for (const n of nodes) {
    const key = LANDMARKS.has(n.role) ? `${n.role} ${bare(n.name ?? "")}` : "rest";
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  return [...groups].map(([key, ns]) => `${key}=${fingerprint(structure("", [], ns, isChrome))}`).sort();
}

/** A short stable hash of a screen's structure (FNV-1a, 32 bits, hex). */
export function fingerprint(lines: string[]): string {
  let h = 0x811c9dc5;
  for (const ch of lines.join("\n")) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * The nodes of `after` that `before` didn't have: a node is new when its line
 * under its ancestors' lines, numbers normalised, isn't in `before` (counted,
 * so a second identical row is new). A new node's whole subtree is new.
 */
export function fresh(before: AriaNode[], after: AriaNode[]): Set<AriaNode> {
  const left = new Map<string, number>();
  const paths = (ns: AriaNode[], at: string, each: (n: AriaNode, path: string) => void) => {
    for (const n of ns) {
      const path = `${at}\n${normalize(nodeLine(n))}`;
      each(n, path);
      paths(n.children, path, each);
    }
  };
  paths(before, "", (_, p) => left.set(p, (left.get(p) ?? 0) + 1));
  const out = new Set<AriaNode>();
  paths(after, "", (n, p) => {
    const k = left.get(p) ?? 0;
    if (k > 0) left.set(p, k - 1);
    else out.add(n);
  });
  return out;
}

/** The tree cut down to the nodes in `keep` and their ancestors: what a click revealed, where it sits. */
export function within(nodes: AriaNode[], keep: Set<AriaNode>): AriaNode[] {
  const out: AriaNode[] = [];
  for (const n of nodes) {
    if (keep.has(n)) out.push(n);
    else {
      const children = within(n.children, keep);
      if (children.length) out.push({ ...n, children });
    }
  }
  return out;
}
