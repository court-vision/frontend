import { describe, expect, test } from "bun:test";
import { deskOfFile } from "@/lib/app-map/map";
import { chromeTest, copyOf, pageParams, seenIn, sweptFile, words } from "@/lib/app-map/sweep";

describe("copyOf", () => {
  test("reads JSX text, attributes, copy props, toasts and sentences", () => {
    const copy = copyOf(
      "Panel.tsx",
      `import { toast } from "sonner";
const MODES = [{ id: "day", label: "One day", note: "Tonight's games only." }];
const BLOCKED = { espn: "ESPN locks this league's lineups after tip." };
const FOCUSABLE = "input, textarea, select, [role='dialog'], [data-radix-popper-content-wrapper]";
const CLASSES = "flex items-center gap-2 text-sm";
export function Panel({ n }: { n: number }) {
  const cls = "panel-root";
  toast.success(\`Pickup of \${n} scheduled for tonight\`);
  return (
    <section aria-label="Market" className={cls}>
      <h2>Free agents</h2>
      <input placeholder="Search players" />
      <p>{n > 1 ? "Several left" : "One left"} &amp; more</p>
      <a href="/draft" title={\`Open \${n}\`}>Draft</a>
    </section>
  );
}`,
    );
    expect(copy).toEqual(
      expect.arrayContaining([
        "One day",
        "Tonight's games only.",
        "ESPN locks this league's lineups after tip.",
        "Pickup of … scheduled for tonight",
        "Market",
        "Free agents",
        "Search players",
        "Several left",
        "One left",
        "& more",
        "Open …",
        "Draft",
      ]),
    );
    expect(copy).not.toContain("panel-root");
    expect(copy.some((c) => c.includes("textarea") || c.includes("items-center"))).toBe(false);
    expect(copy).not.toContain("sonner");
    expect(copy).not.toContain("/draft");
    expect(copy).not.toContain("day");
  });
});

describe("sweptFile", () => {
  test("reads the app's source, not tests, fixtures, demos or generated types", () => {
    expect(sweptFile("src/components/week/Market.tsx")).toBe(true);
    expect(sweptFile("src/types/lineup-editor.ts")).toBe(true);
    expect(sweptFile("src/lib/__tests__/x.test.ts")).toBe(false);
    expect(sweptFile("src/types/generated/api.ts")).toBe(false);
    expect(sweptFile("src/lib/week-demo.ts")).toBe(false);
    expect(sweptFile("src/lib/app-map/aria.ts")).toBe(false);
    expect(sweptFile("scripts/app-map.ts")).toBe(false);
  });
});

describe("chromeTest", () => {
  const isChrome = chromeTest(["Market", "Pick up a free agent", "Autoslot the lineup", "Season averages"]);

  test("calls the app's own words chrome and names data", () => {
    expect(isChrome("Market P")).toBe(true);
    expect(isChrome("Autoslot")).toBe(true);
    expect(isChrome("Free agent")).toBe(true);
    expect(isChrome("Tyrese Maxey")).toBe(false);
    expect(isChrome("Season averages")).toBe(true);
    expect(isChrome("Maxey season averages")).toBe(false);
  });

  test("counts a name with no words as chrome", () => {
    expect(isChrome("2/3")).toBe(true);
    expect(isChrome("⏎")).toBe(true);
  });

  test("folds case and accents", () => {
    expect(words("Nikola Jokić's 3PM")).toEqual(["nikola", "jokic", "pm"]);
  });
});

describe("seenIn", () => {
  const seen = seenIn("- status: Pickup of 2 players scheduled for tonight\n- button \"Don’t drop\"");

  test("finds copy by its fixed parts", () => {
    expect(seen("Pickup of … scheduled for tonight")).toBe(true);
    expect(seen("Don't drop")).toBe(true);
    expect(seen("Pickup of … scheduled for tomorrow")).toBe(false);
  });

  test("never counts copy with nothing fixed to look for", () => {
    expect(seen("…")).toBe(false);
  });
});

describe("pageParams", () => {
  test("reads the values a page compares its params to, and its flags", () => {
    const params = pageParams(`export default async function Page({ searchParams }) {
  const params = await searchParams;
  const view = params.view === "players" ? "players" : params["view"] === "lineup" ? "lineup" : "week";
  const market = params.market === "open";
  const adding = "add" in params;
  const demo = "demo" in params;
  return <Week view={view} market={market} adding={adding} demo={demo} league={params.c} />;
}`);
    expect(params).toEqual({ view: ["players", "lineup"], market: ["open"], add: ["1"] });
  });
});

describe("deskOfFile", () => {
  test("maps a file to its desk by folder", () => {
    expect(deskOfFile("src/components/week/Market.tsx")).toBe("week");
    expect(deskOfFile("src/components/dev/Query.tsx")).toBe("developer");
    expect(deskOfFile("src/app/(desk)/scout/page.tsx")).toBe("scout");
    expect(deskOfFile("src/components/desk/DeskBar.tsx")).toBeNull();
  });
});
