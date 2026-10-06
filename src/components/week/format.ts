/** 1795 → "1,795.0"; null → "—". */
export function pts(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** +83 → "+83.0", −19 → "−19.0" (a real minus sign). */
export function signed(n: number): string {
  const abs = pts(Math.abs(n));
  if (Math.abs(n) < 0.05) return "0.0";
  return `${n > 0 ? "+" : "−"}${abs}`;
}

/** "19:30" → "7:30P". */
export function tip(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]}${h >= 12 ? "P" : "A"}`;
}

/** "vs LAL" → "LAL", "@ LAL" → "@LAL". */
export function oppShort(opp: string | null | undefined): string {
  if (!opp) return "";
  return opp.replace(/^vs\s+/i, "").replace(/^@\s+/, "@");
}

/** "2026-11-10" → "11/10". */
export function monthDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

/** "Nov 9 – 15" for a period. */
export function periodRange(first: string, last: string): string {
  const f = new Date(`${first}T12:00:00`);
  const l = new Date(`${last}T12:00:00`);
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  const tail = month(f) === month(l) ? `${l.getDate()}` : `${month(l)} ${l.getDate()}`;
  return `${month(f)} ${f.getDate()} – ${tail}`;
}

const SUFFIXES = new Set(["JR", "JR.", "SR", "SR.", "II", "III", "IV", "V"]);

/** "Jalen Williams" → "J. Williams"; "Jaren Jackson Jr." → "J. Jackson" (suffixes dropped). */
export function shortName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  while (parts.length > 2 && SUFFIXES.has(parts[parts.length - 1].toUpperCase())) parts.pop();
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}
