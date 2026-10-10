/**
 * The desks: full-screen workspaces that share one frame. Each owns one
 * subject end to end — Week your team's matchup week, Draft a draft room, Scout
 * one player, NBA team or night of games, Developer the API and the data
 * behind the app, Account your teams and alerts — and anything about that
 * subject is a pane, mode or overlay inside it rather than a page of its own.
 */
export const WEEK_DESK = "/week";
export const DRAFT_DESK = "/draft";
export const SCOUT_DESK = "/scout";
export const DEVELOPER_DESK = "/developer";
export const ACCOUNT_DESK = "/account";

/** The desks a tab is shown for: where fantasy work happens, and the Scout. */
export const DESKS = [
  { id: "week", label: "Week", href: WEEK_DESK, key: "1" },
  { id: "draft", label: "Draft", href: DRAFT_DESK, key: "2" },
  { id: "scout", label: "Scout", href: SCOUT_DESK, key: "3" },
] as const;

/** The Developer desk sits behind an icon at the bar's far end, not among the tabs. */
export const DEVELOPER = { id: "developer", label: "Developer", href: DEVELOPER_DESK } as const;

/** The Account desk sits behind your avatar, last on the bar. */
export const ACCOUNT = { id: "account", label: "Account", href: ACCOUNT_DESK } as const;

export const ALL_DESKS = [...DESKS, DEVELOPER, ACCOUNT] as const;

export type DeskId = (typeof ALL_DESKS)[number]["id"];

export function isDeskPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ALL_DESKS.some((d) => pathname === d.href || pathname.startsWith(`${d.href}/`));
}

/**
 * A desk demo's URL, which runs on sample data in the browser and so opens
 * signed out. Only these: a desk's own page with `?demo` (`/week?demo`,
 * `/draft?demo`, `/account?demo`) and the Draft desk's demo rooms
 * (`/draft/demo-3`, `/draft/demo-3/recap`). `?demo` anywhere else, a live room
 * included, leaves that route's sign-in as it is.
 */
export function isDeskDemo(pathname: string, search: URLSearchParams): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (search.has("demo") && ALL_DESKS.some((d) => d.href === path)) return true;
  return path.startsWith(`${DRAFT_DESK}/`) && /^demo-\d+(\/recap)?$/.test(path.slice(DRAFT_DESK.length + 1));
}

/**
 * Query flags a desk page reads by presence alone: `?demo` (every desk),
 * `?add` (Account opens the add-team flow) and `?market` (Week opens the
 * market on its default list).
 */
export const DESK_FLAGS = ["demo", "add", "market"] as const;

/**
 * The query with every bare flag given a value (`?demo` → `?demo=1`), or null
 * when none is bare. Vercel drops a query parameter with no value before the
 * page renders (the proxy still sees it), so the proxy rewrites with this.
 */
export function withFlagValues(search: URLSearchParams): URLSearchParams | null {
  const bare = DESK_FLAGS.filter((f) => search.has(f) && search.getAll(f).every((v) => v === ""));
  if (bare.length === 0) return null;
  const out = new URLSearchParams(search);
  for (const f of bare) out.set(f, "1");
  return out;
}
