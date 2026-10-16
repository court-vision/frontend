import { describe, expect, test } from "bun:test";
import { controlsOf, fingerprint, fresh, parseSnapshot, parts, prune, render, structure, within, type AriaNode } from "@/lib/app-map/aria";
import { screenId } from "@/lib/app-map/map";

// What Playwright 1.56's `ariaSnapshot()` writes for a small page, quoting included
const SNAPSHOT = `- banner:
  - heading "Week" [level=1]
- main:
  - button "Market P" [pressed]
  - 'button "Say: \\"hi\\""'
  - button "it's 'quoted'"
  - link "Draft":
    - /url: /draft?demo=1
  - textbox "Search players":
    - /placeholder: Type a name
  - paragraph: "Points: 23 - yes"
  - paragraph: "- leading dash"
  - list:
    - listitem: Tyrese Maxey
    - listitem: Jalen Brunson
    - listitem: Trae Young
  - radiogroup "Range":
    - radio "Week" [checked]
    - radio "Season"
  - button "Undo" [disabled]
  - 'checkbox "Show #1 [x]"'
  - heading "Roster — 13 players" [level=2]
- contentinfo: J/K move · ⏎ open`;

const chrome = (words: string[]) => (s: string) => (s.toLowerCase().match(/[a-z]+/g) ?? []).every((w) => words.includes(w));

describe("parseSnapshot", () => {
  const tree = parseSnapshot(SNAPSHOT);
  const main = tree[1];

  test("reads roles, names, attributes and nesting", () => {
    expect(tree.map((n) => n.role)).toEqual(["banner", "main", "contentinfo"]);
    expect(tree[0].children[0]).toMatchObject({ role: "heading", name: "Week", attrs: { level: "1" } });
    expect(main.children[0]).toMatchObject({ role: "button", name: "Market P", attrs: { pressed: true } });
    expect(main.children.find((n) => n.name === "Undo")?.attrs.disabled).toBe(true);
  });

  test("unquotes names the way the snapshot quotes them", () => {
    const names = main.children.map((n) => n.name);
    expect(names).toContain('Say: "hi"');
    expect(names).toContain("it's 'quoted'");
    expect(names).toContain("Show #1 [x]");
    expect(main.children.find((n) => n.name === "Show #1 [x]")?.attrs).toEqual({});
  });

  test("keeps text after the colon, quoted or not", () => {
    expect(main.children.filter((n) => n.role === "paragraph").map((n) => n.value)).toEqual(["Points: 23 - yes", "- leading dash"]);
    expect(tree[2].value).toBe("J/K move · ⏎ open");
  });

  test("puts /url and /placeholder on their element", () => {
    expect(main.children.find((n) => n.role === "link")?.props).toEqual({ url: "/draft?demo=1" });
    expect(main.children.find((n) => n.role === "textbox")?.props).toEqual({ placeholder: "Type a name" });
  });

  test("skips lines it can't read", () => {
    expect(parseSnapshot("not yaml\n- button \"Go\"\n\n")).toMatchObject([{ role: "button", name: "Go" }]);
  });
});

describe("prune", () => {
  const isChrome = chrome(["add", "drop", "market", "p"]);
  const slate: AriaNode[] = parseSnapshot(`- list:
  - listitem: A
  - listitem: B
  - listitem: C
  - listitem: D
- button "Tyrese Maxey"
- button "Jalen Brunson"
- button "Trae Young"
- button "Add"
- button "Drop"
- button "Market P"
- tablist:
  - tab "One"
  - tab "Two"
  - tab "Three"`);

  test("keeps two of a list's items and counts the rest", () => {
    const [list] = prune(slate, isChrome);
    expect(list.children.map((n) => n.value)).toEqual(["A", "B"]);
    expect(list.children[1].more).toBe(2);
    expect(render([list])).toEqual(["- list", "  - listitem: A", "  - listitem: B", "  - (… 2 more like the above)"]);
  });

  test("collapses controls named by data, not the app's own controls or choices", () => {
    const names = prune(slate, isChrome).slice(1).map((n) => n.name);
    expect(names).toEqual(["Tyrese Maxey", "Jalen Brunson", "Add", "Drop", "Market P", undefined]);
    expect(prune(slate, isChrome).at(-1)!.children).toHaveLength(3);
  });

  test("collapses runs of identical leaves", () => {
    const games = parseSnapshot(["away", "home", "away", "home", "away", "home"].map((t) => `- text: ${t}`).join("\n"));
    expect(render(prune(games, isChrome))).toEqual(["- text: away", "- text: home", "- text: away", "- (… 1 more like the above)", "- text: home", "- (… 1 more like the above)"]);
  });

  test("leaves its input alone", () => {
    const before = JSON.stringify(slate);
    prune(slate, isChrome);
    expect(JSON.stringify(slate)).toBe(before);
  });
});

describe("controlsOf", () => {
  test("lists the kept controls with the index getByRole finds them by", () => {
    const tree = parseSnapshot(`- button "Open"
- dialog:
  - button "Open" [disabled]
  - textbox "Name"
  - link "Docs":
    - /url: /docs
- list "Pool":
  - listitem:
    - button "Row"
  - listitem:
    - button "Row"
  - listitem:
    - button "Row"
- listbox "Teams":
  - option "Boston Celtics"`);
    expect(controlsOf(tree, chrome(["open", "row", "name", "docs"]))).toEqual([
      { role: "button", name: "Open", nth: 0, disabled: false, example: false },
      { role: "button", name: "Open", nth: 1, disabled: true, example: false, within: "dialog" },
      { role: "textbox", name: "Name", nth: 0, disabled: false, example: false, within: "dialog" },
      { role: "link", name: "Docs", nth: 0, disabled: false, href: "/docs", example: false, within: "dialog" },
      { role: "button", name: "Row", nth: 0, disabled: false, example: false },
      { role: "button", name: "Row", nth: 1, disabled: false, example: false },
      { role: "option", name: "Boston Celtics", nth: 0, disabled: false, example: true, within: "Teams" },
    ]);
  });
});

describe("structure and fingerprint", () => {
  const isChrome = chrome(["close", "next", "game", "move", "of"]);
  const sheet = (team: string, n: number) =>
    parseSnapshot(`- dialog "${team}":
  - heading "${team}" [level=2]
  - button "Close"
  - button "Move ${n} of 3"
  - button "${team} star"`);

  test("is the same for one screen with other data", () => {
    const a = structure("/scout", ["t", "demo"], sheet("Atlanta Hawks", 1), isChrome);
    const b = structure("/scout", ["t"], sheet("Boston Celtics", 2), isChrome);
    expect(a.filter((l) => !l.startsWith("dialog"))).toEqual(b.filter((l) => !l.startsWith("dialog")));
    expect(a).toContain("/scout?t");
    expect(a).toContain("heading 2");
    expect(a).toContain("button Move # of #");
  });

  test("changes when a disclosure opens, not when a choice is picked", () => {
    const hash = (yaml: string) => fingerprint(structure("/week", [], parseSnapshot(yaml), isChrome));
    expect(hash('- button "Next game"')).toMatch(/^[0-9a-f]{8}$/);
    expect(hash('- button "Next game"')).not.toBe(hash('- button "Next game" [expanded]'));
    expect(hash('- button "Next game"')).toBe(hash('- button "Next game" [pressed]'));
    expect(hash('- radio "Next game" [checked]')).toBe(hash('- radio "Next game"'));
    expect(hash('- button "Next game ▾"')).toBe(hash('- button "Next game"'));
  });
});

describe("parts", () => {
  test("hashes each landmark on its own, so a rail and a focus vary apart", () => {
    const page = (rail: string, focus: string) =>
      parts(parseSnapshot(`- radiogroup "Lens":\n  - radio "POOL"\n- complementary:\n  - listbox "${rail}"\n- main:\n  - region "${focus}"`), () => true);
    const [poolPlayer, teamsTeam, poolTeam] = [page("Pool", "Player"), page("Teams", "Team"), page("Pool", "Team")];
    expect(poolPlayer.map((p) => p.split("=")[0])).toEqual(["complementary ", "main ", "rest"]);
    const seen = new Set([...poolPlayer, ...teamsTeam]);
    expect(poolTeam.every((p) => seen.has(p))).toBe(true);
    expect(page("Market", "Team").every((p) => seen.has(p))).toBe(false);
  });
});

describe("fresh and within", () => {
  const before = parseSnapshot(`- radiogroup "Lens":
  - radio "POOL" [checked]
  - radio "TEAMS"
- main:
  - text: Ownership 36.0%
  - button "Theme"`);
  const after = parseSnapshot(`- radiogroup "Lens":
  - radio "POOL"
  - radio "TEAMS" [checked]
- main:
  - text: Ownership 36.1%
  - button "Theme"
- dialog "Teams":
  - option "BOS Boston Celtics"
  - option "BOS Boston Celtics"`);

  test("is what a click added or changed, under where it sits", () => {
    const shown = render(within(after, fresh(before, after)));
    expect(shown).toEqual([
      '- radiogroup "Lens"',
      '  - radio "POOL"',
      '  - radio "TEAMS" [checked]',
      '- dialog "Teams"',
      '  - option "BOS Boston Celtics"',
      '  - option "BOS Boston Celtics"',
    ]);
  });

  test("limits controlsOf to it", () => {
    const only = fresh(before, after);
    expect(controlsOf(after, () => true, only).map((c) => `${c.role} ${c.name} ${c.nth}`)).toEqual([
      "radio POOL 0",
      "radio TEAMS 0",
      "option BOS Boston Celtics 0",
      "option BOS Boston Celtics 1",
    ]);
  });
});

describe("screenId", () => {
  test("slugs the trail under the desk", () => {
    expect(screenId("week", [{ role: "button", name: "Market P" }, { role: "radio", name: "ONE DAY" }])).toBe("week/market-p/one-day");
    expect(screenId("scout", [{ role: "button", name: "2026–27" }])).toBe("scout/x");
    expect(screenId("scout", [{ role: "option", name: "N. Jokić DEN C", example: true, within: "Pool" }])).toBe("scout/pool-option");
  });
});
