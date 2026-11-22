import { describe, expect, test } from "bun:test";
import { FRESH_MS, kindLabel, newsAge, newsStories, sourceLabel, trimHeadline } from "../player-news";
import type { NewsItem } from "@/types/news";

const GRANT = 203924;
const MARA = 1643530;

function item(over: Partial<NewsItem> & Pick<NewsItem, "news_id" | "source" | "headline" | "published_at">): NewsItem {
  return {
    kind: "availability",
    body: null,
    attribution: null,
    url: null,
    players: [{ player_id: GRANT, name: "Jerami Grant" }],
    teams: ["MEM"],
    ...over,
  };
}

describe("sourceLabel and kindLabel", () => {
  test("both ESPN feeds read as ESPN", () => {
    expect(sourceLabel("espn_injuries")).toBe("ESPN");
    expect(sourceLabel("espn_player_news")).toBe("ESPN");
    expect(sourceLabel("rotowire_rss")).toBe("Rotowire");
    expect(sourceLabel("realgm_rss")).toBe("RealGM");
  });

  test("a source the sheet has not met still reads as words", () => {
    expect(sourceLabel("nba_report")).toBe("nba report");
    expect(sourceLabel("bsky_rss")).toBe("bsky");
  });

  test("other has no tag", () => {
    expect(kindLabel("availability")).toBe("Status");
    expect(kindLabel("performance")).toBe("Game");
    expect(kindLabel("other")).toBeNull();
  });
});

describe("trimHeadline", () => {
  test("drops Rotowire's leading name on his own sheet", () => {
    expect(trimHeadline("Jerami Grant: Won't play Saturday", "Jerami Grant")).toBe("Won't play Saturday");
    expect(trimHeadline("aday mara: starting Friday", "Aday Mara")).toBe("Starting Friday");
  });

  test("leaves every other headline alone", () => {
    expect(trimHeadline("Grant (head) is out for Saturday's game against the Nets.", "Jerami Grant")).toBe(
      "Grant (head) is out for Saturday's game against the Nets."
    );
    expect(trimHeadline("Jerami Grant:", "Jerami Grant")).toBe("Jerami Grant:");
    expect(trimHeadline("Jerami Grant: Out", null)).toBe("Jerami Grant: Out");
  });
});

describe("newsStories", () => {
  test("ESPN and Rotowire on the same report minutes apart are one story, led by the fuller item", () => {
    const stories = newsStories(
      [
        item({
          news_id: 2,
          source: "rotowire_rss",
          headline: "Jerami Grant: Won't play Saturday",
          body: "Grant (head) is out for Saturday's game against the Nets.",
          attribution: "Rotowire",
          url: "https://www.rotowire.com/basketball/player/jerami-grant-3588",
          published_at: "2026-11-15T00:35:40Z",
        }),
        item({
          news_id: 1,
          source: "espn_player_news",
          headline: "Grant (head) is out for Saturday's game against the Nets.",
          body: "Grant will miss the second leg of Memphis' back-to-back set due to a head injury. His absence should open up more opportunities for GG Jackson.",
          published_at: "2026-11-15T00:35:10Z",
        }),
      ],
      GRANT
    );
    expect(stories).toHaveLength(1);
    const [s] = stories;
    expect(s.key).toBe(1);
    expect(s.headline).toBe("Grant (head) is out for Saturday's game against the Nets.");
    expect(s.body).toStartWith("Grant will miss");
    expect(s.sources).toEqual([
      { label: "ESPN", url: null },
      { label: "Rotowire", url: "https://www.rotowire.com/basketball/player/jerami-grant-3588" },
    ]);
    expect(s.at).toBe(Date.parse("2026-11-15T00:35:40Z"));
    // "Rotowire" is the source already named, not a reporter
    expect(s.attribution).toBeNull();
  });

  test("ESPN's injury note and its player news with the same words are one ESPN story, even hours apart", () => {
    const head = "Grant (head) is questionable for Saturday's game against the Nets.";
    const stories = newsStories(
      [
        item({ news_id: 1, source: "espn_injuries", headline: head, published_at: "2026-11-14T19:46:00Z" }),
        item({ news_id: 2, source: "espn_player_news", headline: head, kind: "injury", published_at: "2026-11-14T23:10:00Z" }),
      ],
      GRANT
    );
    expect(stories).toHaveLength(1);
    expect(stories[0].sources).toEqual([{ label: "ESPN", url: null }]);
  });

  test("one source posting twice is an update, not a twin", () => {
    const players = [{ player_id: MARA, name: "Aday Mara" }];
    const stories = newsStories(
      [
        item({ news_id: 1, source: "rotowire_rss", kind: "lineup", players, headline: "Aday Mara: Headed to bench", published_at: "2026-11-21T00:53:00Z" }),
        item({ news_id: 2, source: "rotowire_rss", kind: "lineup", players, headline: "Aday Mara: Starting Friday", published_at: "2026-11-21T00:58:00Z" }),
      ],
      MARA
    );
    expect(stories.map((s) => s.headline)).toEqual(["Starting Friday", "Headed to bench"]);
  });

  test("different kinds, or more than half an hour apart, stay apart", () => {
    const stories = newsStories(
      [
        item({ news_id: 1, source: "espn_injuries", kind: "injury", headline: "Powell went to the locker room during Monday's game", published_at: "2026-11-17T01:00:00Z" }),
        item({ news_id: 2, source: "rotowire_rss", kind: "availability", headline: "Norman Powell: Cleared to return", published_at: "2026-11-17T01:10:00Z" }),
        item({ news_id: 3, source: "rotowire_rss", kind: "injury", headline: "Norman Powell: Questionable", published_at: "2026-11-17T02:00:00Z" }),
      ],
      GRANT
    );
    expect(stories.map((s) => s.key)).toEqual([3, 2, 1]);
  });

  test("newest first, the other players named for links, a reporter kept", () => {
    const stories = newsStories(
      [
        item({ news_id: 1, source: "espn_injuries", headline: "Older", published_at: "2026-11-10T12:00:00Z" }),
        item({
          news_id: 2,
          source: "realgm_rss",
          kind: "transaction",
          headline: "Grizzlies Trade Jerami Grant To Hornets",
          attribution: "Shams Charania of ESPN",
          url: "https://basketball.realgm.com/wiretap/1",
          players: [
            { player_id: GRANT, name: "Jerami Grant" },
            { player_id: 1628960, name: "Grayson Allen" },
          ],
          published_at: "2026-11-12T12:00:00Z",
        }),
      ],
      GRANT
    );
    expect(stories.map((s) => s.key)).toEqual([2, 1]);
    expect(stories[0].others).toEqual([{ id: 1628960, name: "Grayson Allen" }]);
    expect(stories[0].attribution).toBe("Shams Charania of ESPN");
    expect(stories[0].sources).toEqual([{ label: "RealGM", url: "https://basketball.realgm.com/wiretap/1" }]);
  });

  test("nothing in, nothing out; an empty blurb is no blurb", () => {
    expect(newsStories([], GRANT)).toEqual([]);
    const [s] = newsStories([item({ news_id: 1, source: "espn_injuries", headline: "Out", body: "  ", published_at: null })], GRANT);
    expect(s.body).toBeNull();
    expect(s.at).toBeNull();
  });
});

describe("newsAge", () => {
  const now = Date.parse("2026-11-22T23:30:00Z");
  const tz = "America/Chicago";

  test("minutes and hours within a day, fresh for three hours", () => {
    expect(newsAge(now - 20_000, now, tz)).toEqual({ text: "just now", fresh: true });
    expect(newsAge(now - 38 * 60_000, now, tz)).toEqual({ text: "38 min ago", fresh: true });
    expect(newsAge(now - 5 * 3_600_000, now, tz)).toEqual({ text: "5 h ago", fresh: false });
    expect(newsAge(now - FRESH_MS + 1, now, tz).fresh).toBe(true);
  });

  test("a day or more back is the viewer's own date", () => {
    // 02:21 UTC on the 21st is still the evening of the 20th in Chicago
    expect(newsAge(Date.parse("2026-11-21T02:21:00Z"), now, tz).text).toBe("Fri Nov 20");
    expect(newsAge(Date.parse("2026-11-21T02:21:00Z"), now, "Europe/Paris").text).toBe("Sat Nov 21");
  });

  test("no time is a dash", () => {
    expect(newsAge(null, now, tz)).toEqual({ text: "—", fresh: false });
  });
});
