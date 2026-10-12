import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { leagueRankingsPlaceholder, rankingsKeys } from "@/hooks/useRankings";
import type { RankingsMeta, RankingsResult, RankingsWindow } from "@/types/rankings";
import { normalizeParams } from "../rankings-params";

// The hook's query, with a fetch that answers team 15 at once and leaves every
// other request in flight, so what shows meanwhile can be read.
function options(teamId: number, window: RankingsWindow) {
  return {
    queryKey: rankingsKeys.league(teamId, normalizeParams({ scope: "league", window })),
    queryFn: () =>
      teamId === 15
        ? Promise.resolve<RankingsResult>({ players: [], meta: { scoring: { league_name: "Dream Shakers" } } as RankingsMeta, message: "" })
        : new Promise<RankingsResult>(() => {}),
    staleTime: Infinity,
    placeholderData: leagueRankingsPlaceholder(teamId),
  };
}

let client: QueryClient;
let unsubscribe = () => {};

afterEach(() => {
  unsubscribe();
  client.clear();
});

async function watching(teamId: number, window: RankingsWindow) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await client.fetchQuery(options(teamId, window));
  const observer = new QueryObserver<RankingsResult>(client, options(teamId, window));
  unsubscribe = observer.subscribe(() => {});
  return observer;
}

describe("a league ranking while the next one loads", () => {
  test("another window keeps the league's rows on screen", async () => {
    const observer = await watching(15, null);
    observer.setOptions(options(15, 7));
    const r = observer.getCurrentResult();
    expect(r.isPlaceholderData).toBe(true);
    expect(r.data?.meta?.scoring?.league_name).toBe("Dream Shakers");
  });

  test("another team's league loads from nothing instead of showing the previous league's numbers", async () => {
    const observer = await watching(15, null);
    observer.setOptions(options(22, null));
    const r = observer.getCurrentResult();
    expect(r.isPlaceholderData).toBe(false);
    expect(r.data).toBeUndefined();
    expect(r.isLoading).toBe(true);
  });
});
