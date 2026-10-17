/**
 * The app map's source sweep (docs/APP_MAP_PLAN.md § 3): the words the app
 * shows its users, read from the source with the TypeScript compiler, no
 * model. The crawler uses them three ways:
 *
 * - **chrome or data:** a name made of the app's own words is UI ("Market P",
 *   "Autoslot"); one that isn't is data ("Tyrese Maxey"), so a list of them is
 *   one list;
 * - **coverage:** copy no crawled screen showed is what the demos can't reach
 *   (category leagues, Yahoo, error states), reported and kept in the map;
 * - **links:** the query params a desk's `page.tsx` reads, and their values.
 */
import ts from "typescript";

/** JSX attributes that are words for the user. */
const ATTRS = new Set(["aria-label", "aria-description", "title", "placeholder", "alt", "label"]);
/** Object-literal properties that are words for the user (option rails, palette entries, desk copy). */
const PROPS = new Set(["label", "note", "hint", "title", "description", "short", "long", "open", "empty", "help", "blurb"]);

const ENTITIES: Record<string, string> = { apos: "'", quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " ", rsquo: "’", lsquo: "‘", mdash: "—", ndash: "–", hellip: "…" };
const decode = (s: string) => s.replace(/&(#\d+|[a-z]+);/gi, (m, e: string) => (e.startsWith("#") ? String.fromCodePoint(Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m));

/** A literal worth keeping: some letters, and not an identifier, class name or path. */
function keep(raw: string, loose: boolean): string | null {
  const s = decode(raw).replace(/\s+/g, " ").trim();
  if (s.length < 2 || !/\p{L}/u.test(s)) return null;
  if (/^[\w.:/@#-]+$/.test(s) && !loose) return null; // "week", "s.click", "/draft", "cv.desk.theme"
  if (/^(https?:|\/|\.|#)/.test(s)) return null;
  return s;
}

/**
 * A plain string in code that reads as a sentence for a person: several words,
 * or a closing stop, and nothing that only code has (a selector's brackets, a
 * class list's colons and dashes).
 */
const sentence = (s: string) =>
  / /.test(s) &&
  !/[[\]{}=<>|]|\w:\w/.test(s) &&
  s.split(" ").filter((w) => /^[a-z]+-[\w-]+$/.test(w)).length < 2 &&
  (/[.!?…]$/.test(s) || s.split(" ").length >= 4);

/**
 * The user-visible strings in one file: JSX text, the attributes above, the
 * properties above, toast messages, and sentence-like strings anywhere (copy
 * tables like `WRITE_BLOCKED_COPY`). A template keeps its fixed parts with
 * "…" for each hole: `Pickup of … scheduled for …`.
 */
export function copyOf(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = new Set<string>();
  const add = (raw: string, loose = false) => {
    const s = keep(raw, loose);
    if (s) out.add(s);
  };
  const literal = (e: ts.Expression, loose: boolean) => {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) add(e.text, loose);
    else if (ts.isTemplateExpression(e)) add([e.head.text, ...e.templateSpans.map((sp) => `…${sp.literal.text}`)].join(""), loose);
    else if (ts.isConditionalExpression(e)) {
      literal(e.whenTrue, loose);
      literal(e.whenFalse, loose);
    } else if (ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.BarBarToken || e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || e.operatorToken.kind === ts.SyntaxKind.PlusToken)) {
      literal(e.left, loose);
      literal(e.right, loose);
    } else if (ts.isParenthesizedExpression(e)) literal(e.expression, loose);
  };
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) add(n.text, true);
    else if (ts.isJsxAttribute(n) && n.initializer && ATTRS.has(n.name.getText(file))) {
      if (ts.isStringLiteral(n.initializer)) add(n.initializer.text, true);
      else if (ts.isJsxExpression(n.initializer) && n.initializer.expression) literal(n.initializer.expression, true);
    } else if (ts.isJsxExpression(n) && n.expression && !ts.isJsxAttribute(n.parent)) literal(n.expression, true);
    else if (ts.isPropertyAssignment(n) && PROPS.has(n.name.getText(file).replace(/["']/g, ""))) literal(n.initializer, true);
    else if (ts.isCallExpression(n) && /^toast(\.\w+)?$/.test(n.expression.getText(file)) && n.arguments[0]) literal(n.arguments[0], true);
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && sentence(n.text) && !ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent)) add(n.text);
    ts.forEachChild(n, visit);
  };
  visit(file);
  return [...out];
}

/** Files the sweep reads: the app's own source, not tests, fixtures, demo data or generated types. */
export function sweptFile(path: string): boolean {
  return (
    /^src\/(components|app|lib|types)\//.test(path) &&
    /\.tsx?$/.test(path) &&
    !/\.d\.ts$|\.test\.tsx?$|__tests__|__fixtures__|\/generated\/|-demo\.ts$|\/app-map\//.test(path)
  );
}

/** The words of a string, folded: lowercase letters only, accents off. */
export function words(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 2);
}

/**
 * Chrome or data, by vocabulary: a name is the app's own words when most of
 * its words appear somewhere in the copy. Single letters (key hints, "P")
 * and numbers don't count either way; a name with no words at all ("2/3",
 * "⏎") is chrome.
 */
export function chromeTest(copy: Iterable<string>): (s: string) => boolean {
  const vocab = new Set<string>();
  for (const c of copy) for (const w of words(c)) vocab.add(w);
  return (s: string) => {
    const ws = words(s);
    if (ws.length === 0) return true;
    return ws.filter((w) => vocab.has(w)).length / ws.length >= 0.75;
  };
}

/** Folded for "does this text appear": case, spacing and curly quotes don't matter. */
const fold = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").toLowerCase();

/**
 * Whether a screen showed this copy: every fixed part of it (split at the
 * template holes, three characters or more) appears in the screens' text.
 */
export function seenIn(corpus: string): (copy: string) => boolean {
  const text = fold(corpus);
  return (copy: string) => {
    const parts = fold(copy)
      .split("…")
      .map((p) => p.trim())
      .filter((p) => p.length >= 3);
    return parts.length > 0 && parts.every((p) => text.includes(p));
  };
}

/**
 * The query params a `page.tsx` compares to literal values, with those values
 * (Week's `view` and `market`), and the flags it reads by presence, as "1"
 * (Account's `add`). `demo` is left out: the crawl adds it itself.
 */
export function pageParams(source: string): Record<string, string[]> {
  const file = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const params: Record<string, Set<string>> = {};
  const note = (k: string, v?: string) => {
    (params[k] ??= new Set());
    if (v) params[k].add(v);
  };
  const visit = (n: ts.Node) => {
    // params.view, params["view"]
    if (ts.isPropertyAccessExpression(n) && n.expression.getText(file) === "params") note(n.name.text);
    else if (ts.isElementAccessExpression(n) && n.expression.getText(file) === "params" && ts.isStringLiteral(n.argumentExpression)) note(n.argumentExpression.text);
    // "add" in params: a flag, read by presence, so "1" opens it
    else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.InKeyword && ts.isStringLiteral(n.left) && n.right.getText(file) === "params") note(n.left.text, "1");
    // params.view === "players", params["view"] === "players"
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isStringLiteral(n.right)) {
      const m = n.left.getText(file).match(/^params(?:\.(\w+)|\[["'](\w+)["']\])$/);
      if (m) note(m[1] ?? m[2], n.right.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(file);
  // Only params with values make links to try: an id (`?c=`) or a bare flag doesn't
  delete params.demo;
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v.size > 0).map(([k, v]) => [k, [...v]]));
}
