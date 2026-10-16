/**
 * The app map's shape (docs/APP_MAP_PLAN.md): what scripts/app-map.ts writes
 * for one build and the backend's `find_in_app` reads. Bump `version` when a
 * field changes meaning.
 */

export const APP_MAP_VERSION = 1;

/** One step of a trail: the control a user clicks. */
export interface MapStep {
  role: string;
  name: string;
  /** The name is data (a player, a team): any of its list does the same. */
  example?: true;
  /** The region, list or dialog the control sits in. */
  within?: string;
  /** What was typed into it: a name from the page, to show what a search opens. */
  typed?: string;
}

/** A desk, as its front screen and the app's own words describe it. */
export interface MapDesk {
  id: string;
  label: string;
  href: string;
  /** The palette's line for it (`routes.ts`). */
  note: string;
  keywords: readonly string[];
  /** "account" when the desk shows a sign-in prompt to a visitor; null when it opens signed out. */
  needs: "account" | null;
  /** The desk's footer: its keys, as the desk writes them. */
  keys: string | null;
}

/** One distinct screen: where it is, how to get there, and what is on it. */
export interface MapScreen {
  id: string;
  desk: string;
  /** "Market P › ONE DAY": the trail's names, for people. */
  title: string;
  /** The clicks from the desk's front, in order; empty for the front itself. */
  trail: MapStep[];
  /** Where it was seen, `?demo` taken out. */
  url: string;
  /** A link that opens it directly, checked by loading it; null when only the clicks reach it. */
  link: string | null;
  /** Query params whose value picks the subject (`t` in `/scout?t=ATL`): the link is one example. */
  linkVaries: string[];
  /** The front's whole pruned tree, or what the last step revealed. */
  tree: string;
  /** Structure hash: equal for two screens that are the same screen with other data. */
  fingerprint: string;
}

/** Copy from one source file, split by whether any crawled screen showed it. */
export interface MapCopy {
  file: string;
  desk: string | null;
  seen: string[];
  unseen: string[];
}

export interface AppMap {
  version: number;
  /** The commit the crawled build came from. */
  build: string;
  crawledAt: string;
  desks: MapDesk[];
  screens: MapScreen[];
  /** Copy per file; `unseen` is what the map knows only from the source. */
  copy: MapCopy[];
  /** What a reviewer should look at: controls with no name, clicks that failed, limits reached. */
  findings: { kind: string; desk: string; detail: string }[];
}

/** The desk a source file belongs to, by its folder (`src/components/week/…` → week). */
export function deskOfFile(path: string): string | null {
  const m = path.match(/^src\/(?:components\/(week|draft|scout|ai|dev|account)\/|app\/\(desk\)\/(week|draft|scout|ai|developer|account)\/)/);
  const d = m?.[1] ?? m?.[2] ?? null;
  return d === "dev" ? "developer" : d;
}

/**
 * "Market P › ONE DAY" → "week/market-p/one-day": a screen id from its desk
 * and trail. A step named by data is named by where it sits instead
 * ("scout/pool-option"), so the id doesn't change with the data.
 */
export function screenId(desk: string, trail: MapStep[]): string {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/\d+/g, "")
      .replace(/[^a-z]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "x";
  return [desk, ...trail.map((t) => slug(t.example ? `${t.within ?? ""} ${t.role}` : t.typed ? `${t.name} results` : t.name))].join("/");
}
