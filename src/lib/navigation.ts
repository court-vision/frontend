/**
 * Single source of truth for app navigation: nav bar tabs, phone tab bar,
 * mobile sheet, command-palette entries, keyboard shortcuts, and page slide order.
 *
 * ⌥1–7 mirror the desktop tab order (Draft sits between Rankings and
 * Playoffs on ⌘D alone — every ⌥ digit is taken); ⌥8/⌥9 reach
 * Lineups/Streamers, which have no desktop tab. ⌘-letter shortcuts are
 * letters only (⌘1-9 collides with browser tab switching).
 */

import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  ClipboardList,
  Code,
  Database,
  Home,
  Medal,
  Settings,
  Swords,
  Terminal,
  Trophy,
  User,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

export interface NavItem {
  href: string;
  /** Desktop tab label (short). */
  label: string;
  /** Mobile sheet label; defaults to `label`. */
  mobileLabel?: string;
  /** Command palette label without the "Go to" prefix; defaults to `mobileLabel ?? label`. */
  paletteLabel?: string;
  icon: LucideIcon;
  description: string;
  keywords: string[];
  /** ⌥+digit shortcut (physical key). */
  altDigit?: number;
  /** ⌘+letter shortcut. */
  cmdKey?: string;
  desktop?: boolean;
  mobile?: boolean;
  palette?: boolean;
  /** Needs a wide screen: hidden from the phone sheet and, below `lg`, from the palette. */
  desktopOnly?: boolean;
  /** Position in the signed-in phone tab bar (1-based); the fifth tab is always "More". */
  tab?: number;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: Home,
    description: "Navigate to the home page",
    keywords: ["home", "dashboard", "main"],
    altDigit: 1,
    desktop: true,
    mobile: true,
    palette: true,
  },
  {
    href: "/your-teams",
    label: "Teams",
    mobileLabel: "Your Teams",
    icon: Users,
    description: "Roster overview and team analysis",
    keywords: ["teams", "my teams", "roster"],
    altDigit: 2,
    cmdKey: "t",
    desktop: true,
    mobile: true,
    palette: true,
    tab: 4,
  },
  {
    href: "/matchup",
    label: "Matchup",
    icon: Swords,
    description: "View the matchup for the week",
    keywords: ["matchup", "schedule", "week", "opponent"],
    altDigit: 3,
    cmdKey: "m",
    desktop: true,
    mobile: true,
    palette: true,
    tab: 1,
  },
  {
    href: "/rankings",
    label: "Rankings",
    icon: Trophy,
    description: "View player rankings and stats",
    keywords: ["rankings", "leaderboard", "players"],
    altDigit: 4,
    cmdKey: "r",
    desktop: true,
    mobile: true,
    palette: true,
    tab: 3,
  },
  {
    href: "/draft",
    label: "Draft",
    mobileLabel: "Draft Lab",
    icon: ClipboardList,
    description: "Draft-day board, recommendations and pick tracking",
    keywords: ["draft", "draft lab", "board", "adp", "picks", "draft day"],
    cmdKey: "d",
    desktop: true,
    mobile: true,
    palette: true,
  },
  {
    href: "/playoffs",
    label: "Playoffs",
    icon: Medal,
    description: "NBA playoff bracket and series",
    keywords: ["playoffs", "bracket", "series", "postseason"],
    altDigit: 5,
    desktop: true,
    mobile: true,
    palette: true,
  },
  {
    href: "/terminal",
    label: "Terminal",
    icon: Terminal,
    description: "Open the analytics terminal",
    keywords: ["terminal", "command bar", "search", "analytics"],
    altDigit: 6,
    desktop: true,
    mobile: true,
    palette: true,
    desktopOnly: true,
  },
  {
    href: "/query-builder",
    label: "SQL",
    mobileLabel: "Query Builder",
    icon: Database,
    description: "Open the SQL query builder",
    keywords: ["query", "sql", "database", "builder", "sqlmate"],
    altDigit: 7,
    desktop: true,
    mobile: true,
    palette: true,
    desktopOnly: true,
  },
  {
    href: "/lineup-generation",
    label: "Lineups",
    mobileLabel: "Lineup Generation",
    icon: Zap,
    description: "Generate optimized lineups",
    keywords: ["generate", "lineup", "optimize", "auto"],
    altDigit: 8,
    cmdKey: "g",
    mobile: true,
    palette: true,
  },
  {
    href: "/streamers",
    label: "Streamers",
    icon: UserPlus,
    description: "View the streamers for the week",
    keywords: ["streamers", "stream", "week", "free agents", "pickups"],
    altDigit: 9,
    cmdKey: "s",
    mobile: true,
    palette: true,
    tab: 2,
  },
  {
    href: "/manage-teams",
    label: "Manage Teams",
    icon: Settings,
    description: "Add or edit team configurations",
    keywords: ["manage", "teams", "connect", "add team", "configure"],
    mobile: true,
    palette: true,
  },
  {
    href: "/manage-lineups",
    label: "Manage Lineups",
    icon: Calendar,
    description: "Review your saved lineups",
    keywords: ["lineups", "manage", "saved"],
    palette: true,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    description: "League format, notifications, and developer settings",
    keywords: ["settings", "configure", "preferences", "league", "notifications"],
    mobile: true,
    palette: true,
  },
  {
    href: "/account",
    label: "Account",
    icon: User,
    description: "View your account information",
    keywords: ["account", "profile"],
    mobile: true,
    palette: true,
  },
  {
    href: "/developer",
    label: "Developer Portal",
    icon: Code,
    description: "Access the developer documentation and API keys",
    keywords: ["developer", "portal", "documentation", "api"],
    palette: true,
  },
];

export const DESKTOP_NAV = NAV_ITEMS.filter((i) => i.desktop);
export const MOBILE_NAV = NAV_ITEMS.filter((i) => i.mobile && !i.desktopOnly);
export const PALETTE_NAV = NAV_ITEMS.filter((i) => i.palette);

/** Signed-in phone tab bar, in `tab` order; the bar appends "More". */
export const TAB_NAV = NAV_ITEMS.filter((i) => i.tab !== undefined).sort(
  (a, b) => (a.tab as number) - (b.tab as number)
);

/** Signed-out phone tab bar; the bar appends "Sign in" and "More". */
export const SIGNED_OUT_TAB_NAV = ["/", "/rankings", "/playoffs"].map(
  (href) => NAV_ITEMS.find((i) => i.href === href) as NavItem
);

/** Page order used for slide-transition direction. */
export const ROUTE_ORDER = DESKTOP_NAV.map((i) => i.href);

/** `Digit1` → `/` etc. Keyed by `KeyboardEvent.code` (macOS transforms ⌥+digit in `e.key`). */
export const ALT_SHORTCUTS: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.filter((i) => i.altDigit !== undefined).map((i) => [`Digit${i.altDigit}`, i.href])
);

/** `t` → `/your-teams` etc. Keyed by lowercase `e.key`. */
export const CMD_SHORTCUTS: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.filter((i) => i.cmdKey).map((i) => [i.cmdKey as string, i.href])
);

const ALT_DIGITS = NAV_ITEMS.map((i) => i.altDigit).filter((d): d is number => d !== undefined);
/** e.g. `⌥1-9` — derived so copy never drifts from the handlers. */
export const ALT_RANGE_LABEL = `⌥${Math.min(...ALT_DIGITS)}-${Math.max(...ALT_DIGITS)}`;

export function altShortcutLabel(item: Pick<NavItem, "altDigit">): string | undefined {
  return item.altDigit !== undefined ? `⌥${item.altDigit}` : undefined;
}

export function cmdShortcutLabel(item: Pick<NavItem, "cmdKey">): string | undefined {
  return item.cmdKey ? `⌘${item.cmdKey.toUpperCase()}` : undefined;
}

/** Preferred single shortcut for display: ⌘-letter when present, else ⌥-digit. */
export function shortcutLabel(item: Pick<NavItem, "altDigit" | "cmdKey">): string | undefined {
  return cmdShortcutLabel(item) ?? altShortcutLabel(item);
}

export function paletteLabel(item: NavItem): string {
  return item.paletteLabel ?? item.mobileLabel ?? item.label;
}
