/**
 * The desk themes the picker offers, in its order. Each id names a token block
 * in desk.module.css (`.tokens[data-theme=…]`) and is what storage remembers,
 * so never rename one. `scheme` picks the team-logo variant and the toast
 * theme, and sorts the picker; T swaps between the last light and last dark pick.
 */
export type DeskScheme = "light" | "dark";

export interface DeskThemeInfo {
  id: string;
  label: string;
  scheme: DeskScheme;
  /** One line under the name in the picker. */
  note: string;
}

export const DESK_THEMES = [
  { id: "paper", label: "Paper", scheme: "light", note: "Warm newsprint, ink and court orange" },
  { id: "fog", label: "Fog", scheme: "light", note: "Cool blue-grey with an ocean accent" },
  { id: "pressbox", label: "Press Box", scheme: "light", note: "Stone body under a dark scoreboard bar" },
  { id: "light", label: "Original light", scheme: "light", note: "White panels, the first desk palette" },
  { id: "graphite", label: "Graphite", scheme: "dark", note: "Lifted charcoal, every edge drawn" },
  { id: "midnight", label: "Midnight", scheme: "dark", note: "Deep navy, sky accent, a soft glow" },
  { id: "ember", label: "Ember", scheme: "dark", note: "Warm charcoal and amber" },
  { id: "volt", label: "Volt", scheme: "dark", note: "Near-black, bright rules, volt accent" },
  { id: "dark", label: "Original dark", scheme: "dark", note: "Near-black, the first desk palette" },
] as const satisfies readonly DeskThemeInfo[];

export type DeskThemeId = (typeof DESK_THEMES)[number]["id"];

export const DEFAULT_LIGHT: DeskThemeId = "paper";
export const DEFAULT_DARK: DeskThemeId = "graphite";

const BY_ID = new Map<string, DeskThemeInfo>(DESK_THEMES.map((t) => [t.id, t]));

export function isDeskTheme(id: unknown): id is DeskThemeId {
  return typeof id === "string" && BY_ID.has(id);
}

export function themeScheme(id: DeskThemeId): DeskScheme {
  return BY_ID.get(id)?.scheme ?? "dark";
}
