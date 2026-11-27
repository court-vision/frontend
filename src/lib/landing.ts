import { DEFAULT_DARK, DEFAULT_LIGHT, themeScheme, type DeskThemeId } from "@/components/desk/themes";

/**
 * The landing page's desks, each shown the way it looks: a tab per desk and a
 * picture of it in the visitor's theme (public/landing/<desk>-<theme>.webp,
 * made by scripts/landing-shots.mjs from the desks' demos; keep its list of
 * desks in step with this one).
 */
export interface LandingDesk {
  id: string;
  name: string;
  /** A small mark beside the name ("Beta"). */
  badge?: string;
  short: string;
  long: string;
  href: string;
  open: string;
}

export const LANDING_DESKS: readonly LandingDesk[] = [
  {
    id: "home",
    name: "Home",
    short: "Every team at a glance",
    long: "Every team you run on one board: tonight's score as it moves, what each team still needs before its next lock, and what runs next on its own. Open any team's week from its row.",
    href: "/home?demo",
    open: "Open the Home demo",
  },
  {
    id: "week",
    name: "Week",
    short: "Set every day's lineup",
    long: "Your matchup week, a column per day: who plays, who sits and what each day is worth. Move players on any day, find pickups for the days you are short, lock the players nothing should drop, and send it all to ESPN.",
    href: "/week?demo",
    open: "Open the Week demo",
  },
  {
    id: "draft",
    name: "Draft",
    short: "Draft live, or mock first",
    long: "Follow your ESPN draft as it happens, or run a mock against the field. At every pick the board ranks who is left for your roster, points or categories, and the recap grades each pick when it is over.",
    href: "/draft?demo",
    open: "Open the Draft demo",
  },
  {
    id: "scout",
    name: "Scout",
    short: "Look anyone up",
    long: "One player, team or night at a time, with every public number Court Vision keeps: rankings repriced every day, game logs, splits, and who is being added and dropped across ESPN.",
    href: "/scout",
    open: "Open Scout",
  },
  {
    id: "ai",
    name: "AI",
    badge: "Beta",
    short: "Ask Dime, or let it drive",
    long: "Dime reads your matchup, roster, the free-agent pool and the box scores, and answers with the numbers behind them. It checks in on your team through the day, logs every call on a timeline, and on autopilot makes the moves itself within your league's limits. In beta, open to a few accounts for now.",
    href: "/ai?demo",
    open: "Open the AI demo",
  },
  {
    id: "dev",
    name: "Developer",
    short: "Use the data yourself",
    long: "The same numbers through a public API. Read the reference, send requests from the playground, make keys, and query the tables directly.",
    href: "/developer",
    open: "Open the Developer desk",
  },
];

/**
 * The pictures' size in real pixels: the desks at 1440×900, taken at twice the
 * pixel density so they stay sharp on high-density screens. A test checks every file.
 */
export const LANDING_SHOT_SIZE = { width: 2880, height: 1800 } as const;

/** The themes the pictures were taken in (scripts/landing-shots.mjs). A test checks it names every desk theme. */
export const LANDING_SHOT_THEMES: readonly DeskThemeId[] = ["noon", "midnight", "paper", "ember", "chalk", "blacktop", "harvest", "hearth"];

/**
 * A desk's picture in a theme. A theme with no pictures yet (one added since
 * they were last taken) shows the default theme on its side, never a broken image.
 */
export function landingShot(desk: string, theme: DeskThemeId): string {
  const shown = LANDING_SHOT_THEMES.includes(theme) ? theme : themeScheme(theme) === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT;
  return `/landing/${desk}-${shown}.webp`;
}
