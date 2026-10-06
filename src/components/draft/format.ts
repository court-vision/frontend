/** "Nikola Jokić" → "N. Jokić"; suffixes (Jr., III) dropped. */
export function shortName(name: string): string {
  const parts = name.split(" ").filter((p) => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(p));
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

export function num(v: number | null | undefined, places = 1): string {
  return v == null ? "—" : v.toFixed(places);
}

export function signed(v: number | null | undefined, places = 1): string {
  if (v == null) return "—";
  const r = Number(v.toFixed(places));
  return r > 0 ? `+${r.toFixed(places)}` : r.toFixed(places);
}

/** Thousands with a thin separator: 2,113. */
export function big(v: number | null | undefined): string {
  return v == null ? "—" : Math.round(v).toLocaleString("en-US");
}

export function seatName(seat: number | null | undefined, mySlot: number | null | undefined): string {
  if (seat == null) return "—";
  return seat === mySlot ? "You" : `Seat ${seat}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** A category value as the board shows it: percentages as .xxx, counts to one place. */
export function catValue(v: number | null | undefined, isRate: boolean): string {
  if (v == null) return "—";
  return isRate ? v.toFixed(3).replace(/^0/, "") : v.toFixed(1);
}

/** API timestamps are ISO with an offset, or naive UTC. */
export function apiTime(value: string | null | undefined): number {
  if (!value) return 0;
  const zoned = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const ms = Date.parse(zoned);
  return Number.isNaN(ms) ? 0 : ms;
}

export const KIND_LABEL = { live: "ESPN draft", mock: "Mock", manual: "Manual", import: "Imported" } as const;
