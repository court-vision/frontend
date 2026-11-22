/**
 * A player's news as the Scout sheet shows it: the items the news pipeline
 * stored about him (ESPN's injury notes and player news, Rotowire, RealGM),
 * folded into stories. Pure, so it is tested without React.
 *
 * Two sources often carry the same story minutes apart: ESPN's injury note and
 * its player news repeat each other word for word, and Rotowire posts its own
 * line for the same report. About one item in three has such a twin, so a
 * list of raw items reads every story twice. Items fold into one story when
 * they are of one kind, come from different sources and were published within
 * half an hour of each other, or when their headlines are the same words. Two
 * items from the same source never fold: a source posting twice is an update
 * ("Headed to bench", then "Starting Friday").
 */
import type { NewsItem, NewsKind } from "@/types/news";

/** How far back the sheet asks, and how many items. */
export const NEWS_DAYS = 14;
export const NEWS_LIMIT = 30;
/** Stories shown before "Show more". */
export const NEWS_SHOWN = 3;
/** Items of one kind from two sources this close together tell one story. */
export const SAME_STORY_MS = 30 * 60_000;
/** An item younger than this has its age marked. */
export const FRESH_MS = 3 * 3_600_000;
/** A blurb longer than this is clamped until it is opened. */
export const LONG_BODY = 160;

export interface NewsSource {
  label: string;
  url: string | null;
}

export interface NewsStory {
  /** The leading item's id. */
  key: number;
  /** The newest of its items, in ms; null when none has a time. */
  at: number | null;
  kind: NewsKind;
  headline: string;
  body: string | null;
  /** The reporter or outlet, when it says more than the source's name. */
  attribution: string | null;
  /** The leading item's source first, each name once. */
  sources: NewsSource[];
  /** The other players the story is about, for links. */
  others: Array<{ id: number; name: string }>;
}

const SOURCE_LABELS: Record<string, string> = {
  espn_injuries: "ESPN",
  espn_player_news: "ESPN",
  rotowire_rss: "Rotowire",
  realgm_rss: "RealGM",
};

/** The outlet's name: "ESPN", "Rotowire", "RealGM". */
export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_rss$/, "").replace(/_/g, " ");
}

const KIND_LABELS: Partial<Record<NewsKind, string>> = {
  injury: "Injury",
  availability: "Status",
  lineup: "Lineup",
  transaction: "Transaction",
  performance: "Game",
  rumor: "Rumor",
};

/** A short tag for the kind; none for "other". */
export function kindLabel(kind: NewsKind): string | null {
  return KIND_LABELS[kind] ?? null;
}

function timeOf(item: NewsItem): number | null {
  if (!item.published_at) return null;
  const t = Date.parse(item.published_at);
  return Number.isNaN(t) ? null : t;
}

function words(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Rotowire leads each headline with the player's name ("Aday Mara: Starting
 * Friday"); on his own sheet the name says nothing. Any other headline comes
 * back as it is.
 */
export function trimHeadline(headline: string, name: string | null | undefined): string {
  const text = headline.trim();
  if (!name) return text;
  const lead = `${name.trim()}:`;
  if (text.length > lead.length && text.slice(0, lead.length).toLowerCase() === lead.toLowerCase()) {
    const rest = text.slice(lead.length).trim();
    return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : text;
  }
  return text;
}

function sameStory(group: NewsItem[], item: NewsItem): boolean {
  if (group.some((m) => m.source === item.source)) return false;
  const head = words(item.headline);
  if (head && group.some((m) => words(m.headline) === head)) return true;
  if (group[0].kind !== item.kind) return false;
  const t = timeOf(item);
  if (t == null) return false;
  return group.some((m) => {
    const mt = timeOf(m);
    return mt != null && Math.abs(mt - t) <= SAME_STORY_MS;
  });
}

function textLength(item: NewsItem): number {
  return item.headline.length + (item.body?.length ?? 0);
}

/**
 * The player's items as stories, newest first. The story leads with the item
 * that says the most (ESPN's note usually: the facts in its headline, the
 * fantasy angle in its blurb) and lists every source that carried it.
 */
export function newsStories(items: NewsItem[], playerId: number): NewsStory[] {
  const sorted = [...items].sort((a, b) => (timeOf(b) ?? 0) - (timeOf(a) ?? 0) || b.news_id - a.news_id);
  const groups: NewsItem[][] = [];
  for (const item of sorted) {
    const group = groups.find((g) => sameStory(g, item));
    if (group) group.push(item);
    else groups.push([item]);
  }

  return groups.map((group) => {
    const lead = group.reduce((best, m) => (textLength(m) > textLength(best) ? m : best), group[0]);
    const members = [lead, ...group.filter((m) => m !== lead)];
    const sources: NewsSource[] = [];
    for (const m of members) {
      const label = sourceLabel(m.source);
      const seen = sources.find((x) => x.label === label);
      if (!seen) sources.push({ label, url: m.url ?? null });
      else if (!seen.url && m.url) seen.url = m.url;
    }
    const others = new Map<number, string>();
    for (const m of members) {
      for (const p of m.players) if (p.player_id !== playerId && !others.has(p.player_id)) others.set(p.player_id, p.name);
    }
    const own = members.flatMap((m) => m.players).find((p) => p.player_id === playerId)?.name;
    const times = group.map(timeOf).filter((t): t is number => t != null);
    const attribution = lead.attribution?.trim() || null;
    return {
      key: lead.news_id,
      at: times.length ? Math.max(...times) : null,
      kind: lead.kind,
      headline: trimHeadline(lead.headline, own),
      body: lead.body?.trim() || null,
      attribution: attribution && !sources.some((x) => x.label.toLowerCase() === attribution.toLowerCase()) ? attribution : null,
      sources,
      others: [...others].map(([id, name]) => ({ id, name })),
    };
  });
}

const DAY_FORMATS = new Map<string, Intl.DateTimeFormat>();

function dayFormat(tz: string): Intl.DateTimeFormat {
  let f = DAY_FORMATS.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
    DAY_FORMATS.set(tz, f);
  }
  return f;
}

/**
 * How old a story is, for the sheet's time column: "just now", "38 min ago",
 * "5 h ago" within a day, then the viewer's own date ("Sat Nov 21").
 */
export function newsAge(at: number | null, now: number, tz: string): { text: string; fresh: boolean } {
  if (at == null) return { text: "—", fresh: false };
  const elapsed = Math.max(0, now - at);
  const minutes = Math.floor(elapsed / 60_000);
  const fresh = elapsed < FRESH_MS;
  if (minutes < 1) return { text: "just now", fresh };
  if (minutes < 60) return { text: `${minutes} min ago`, fresh };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { text: `${hours} h ago`, fresh };
  return { text: dayFormat(tz).format(at).replace(",", ""), fresh };
}
