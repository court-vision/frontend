import { describe, expect, test } from "bun:test";
import { groupMatches, matchCommands, type PaletteEntry } from "@/lib/palette";

const ENTRIES: PaletteEntry[] = [
  { label: "Week", note: "Your team's matchup week", group: "Desks", keywords: ["matchup", "lineup"] },
  { label: "Scout", note: "One player, NBA team or night of games", group: "Desks", keywords: ["players", "rankings", "standings"] },
  { label: "Standings", note: "both conferences, record and ratings", group: "Scout", keywords: ["scout", "teams"] },
  { label: "Lvl. 3 Goblins", note: "ESPN · PTS", group: "Teams", keywords: ["team", "switch", "The Dunk Tank"] },
  { label: "Nikola Jokić", note: "DEN · C", group: "Players" },
  { label: "Teams and connections", group: "Account", keywords: ["account", "settings"] },
  { label: "Sign out", group: "Account", keywords: ["log out", "logout"] },
];

const labels = (q: string) => matchCommands(q, ENTRIES).map((e) => e.label);

describe("matchCommands", () => {
  test("a blank query keeps everything, in order", () => {
    expect(labels("")).toEqual(ENTRIES.map((e) => e.label));
    expect(labels("   ")).toEqual(ENTRIES.map((e) => e.label));
  });

  test("the label's own start comes first; a keyword, the note or the group after, in the order given", () => {
    expect(labels("team")).toEqual(["Teams and connections", "Week", "Scout", "Standings", "Lvl. 3 Goblins"]);
    expect(labels("goblins")).toEqual(["Lvl. 3 Goblins"]);
    expect(labels("pts")).toEqual(["Lvl. 3 Goblins"]);
    expect(labels("logout")).toEqual(["Sign out"]);
  });

  test("ties keep the order given", () => {
    expect(labels("s")).toEqual(["Scout", "Standings", "Sign out", "Lvl. 3 Goblins", "Teams and connections"]);
  });

  test("one letter matches only the start of a word", () => {
    expect(labels("k")).toEqual([]);
    expect(labels("eek")).toEqual(["Week"]);
  });

  test("every word of the query has to land, in any order", () => {
    expect(labels("matchup week")).toEqual(["Week"]);
    expect(labels("week matchup")).toEqual(["Week"]);
    expect(labels("week nothing")).toEqual([]);
  });

  test("accents and case do not matter", () => {
    expect(labels("jokic")).toEqual(["Nikola Jokić"]);
    expect(labels("JOKIĆ")).toEqual(["Nikola Jokić"]);
    expect(labels("dunk tank")).toEqual(["Lvl. 3 Goblins"]);
  });

  test("the group is searchable too", () => {
    expect(labels("account")).toEqual(["Teams and connections", "Sign out"]);
  });
});


const ORDER = ["Desks", "Scout", "Teams", "Players", "Account"];
const grouped = (q: string) => groupMatches(q, ENTRIES, ORDER).map((g) => [g.group, g.best, g.entries.map((e) => e.label)]);

describe("groupMatches", () => {
  test("a blank query lists every group in the order given, each in the order given", () => {
    expect(grouped("")).toEqual([
      ["Desks", 0, ["Week", "Scout"]],
      ["Scout", 0, ["Standings"]],
      ["Teams", 0, ["Lvl. 3 Goblins"]],
      ["Players", 0, ["Nikola Jokić"]],
      ["Account", 0, ["Teams and connections", "Sign out"]],
    ]);
  });

  test("with a query the group holding the best match comes first, whatever the order given", () => {
    // "stand" is Standings itself (Scout) before Scout, which only carries it as a keyword (Desks).
    expect(grouped("stand")).toEqual([
      ["Scout", 0, ["Standings"]],
      ["Desks", 2, ["Scout"]],
    ]);
    expect(grouped("team")).toEqual([
      ["Account", 0, ["Teams and connections"]],
      ["Desks", 2, ["Week", "Scout"]],
      ["Scout", 2, ["Standings"]],
      ["Teams", 2, ["Lvl. 3 Goblins"]],
    ]);
  });

  test("groups with nothing match are left out, and a group the order does not name goes last", () => {
    expect(grouped("jokic")).toEqual([["Players", 1, ["Nikola Jokić"]]]);
    expect(groupMatches("", ENTRIES, ["Account"]).map((g) => g.group)).toEqual(["Account", "Desks", "Scout", "Teams", "Players"]);
  });
});
