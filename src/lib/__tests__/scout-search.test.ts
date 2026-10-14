import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { playerSearchQuery, scoutKeys } from "@/hooks/useScout";
import { directoryMatches } from "@/lib/scout";
import type { PlayerSearchData, PlayerSearchItem } from "@/types/scout";

const noop = () => {};

function item(id: number, name: string): PlayerSearchItem {
  return { id, espn_id: null, name, position: "C", team: null, player_updated_at: "2026-10-01T00:00:00Z", profile_updated_at: null };
}

function answer(query: string, players: PlayerSearchItem[]): PlayerSearchData {
  return { query, players, limit: 12, offset: 0, total: players.length };
}

describe("the directory search", () => {
  const jo = answer("jo", [item(1, "Nikola Jokić"), item(2, "Cameron Johnson"), item(3, "Tre Jones")]);

  test("an answer to this very term is the server's, whole", () => {
    expect(directoryMatches(answer("2039", [item(203999, "Nikola Jokić")]), "2039").map((p) => p.id)).toEqual([203999]);
  });

  test("an earlier term's answer keeps only the names that still match, accents aside", () => {
    expect(directoryMatches(jo, "joki").map((p) => p.id)).toEqual([1]);
    expect(directoryMatches(jo, "JOH ").map((p) => p.id)).toEqual([2]);
    expect(directoryMatches(jo, "curry")).toEqual([]);
  });

  test("nothing under two characters, and nothing without an answer", () => {
    expect(directoryMatches(jo, "j")).toEqual([]);
    expect(directoryMatches(undefined, "jok")).toEqual([]);
  });
});

describe("the directory query between terms", () => {
  let unsubscribe = () => {};
  afterEach(() => unsubscribe());

  test("the last answer stays on screen while the next term is asked for", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(scoutKeys.search("jok"), answer("jok", [item(1, "Nikola Jokić"), item(4, "Jokubas Example")]));
    const observer = new QueryObserver(client, playerSearchQuery("jok"));
    unsubscribe = observer.subscribe(noop);
    // The next term's request stays in flight, so what shows meanwhile can be read.
    observer.setOptions({ ...playerSearchQuery("joki"), queryFn: () => new Promise<PlayerSearchData>(() => {}) });
    const r = observer.getCurrentResult();
    expect(r.isPlaceholderData).toBe(true);
    expect(directoryMatches(r.data, "joki").map((p) => p.name)).toEqual(["Nikola Jokić"]);
  });
});
