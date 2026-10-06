/**
 * The desks: full-screen workspaces that share one shell. Each owns one
 * subject end to end — Week your team's matchup week, Draft a draft room — and
 * anything about that subject is a pane, mode or overlay inside it rather than
 * a page of its own. The rest of the app does not render its chrome around a
 * desk route.
 */
export const DESKS = [
  { id: "week", label: "Week", href: "/week", key: "1" },
  { id: "draft", label: "Draft", href: "/draft", key: "2" },
] as const;

export type DeskId = (typeof DESKS)[number]["id"];

export function isDeskPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return DESKS.some((d) => pathname === d.href || pathname.startsWith(`${d.href}/`));
}
