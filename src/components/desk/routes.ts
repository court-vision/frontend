/**
 * The desks: full-screen workspaces that share one shell. Each owns one
 * subject end to end — Week your team's matchup week, Draft a draft room — and
 * anything about that subject is a pane, mode or overlay inside it rather than
 * a page of its own. The rest of the app does not render its chrome around a
 * desk route.
 */
/**
 * The Draft desk's home. The old Draft Lab keeps `/draft` until the cutover, so
 * both can run side by side; at the cutover this becomes "/draft".
 */
export const DRAFT_DESK = "/lab";

export const DESKS = [
  { id: "week", label: "Week", href: "/week", key: "1" },
  { id: "draft", label: "Draft", href: DRAFT_DESK, key: "2" },
] as const;

export type DeskId = (typeof DESKS)[number]["id"];

export function isDeskPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return DESKS.some((d) => pathname === d.href || pathname.startsWith(`${d.href}/`));
}

/**
 * A desk demo's URL, which runs on sample data in the browser and so opens
 * signed out. Only these: a desk's own page with `?demo` (`/week?demo`,
 * `/lab?demo`) and the Draft desk's demo rooms (`/lab/demo-3`,
 * `/lab/demo-3/recap`). `?demo` anywhere else, a live room included, leaves
 * that route's sign-in as it is.
 */
export function isDeskDemo(pathname: string, search: URLSearchParams): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (search.has("demo") && DESKS.some((d) => d.href === path)) return true;
  return path.startsWith(`${DRAFT_DESK}/`) && /^demo-\d+(\/recap)?$/.test(path.slice(DRAFT_DESK.length + 1));
}
