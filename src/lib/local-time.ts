/**
 * Clock times in the viewer's own time zone.
 *
 * The NBA and ESPN keep Eastern time: a tip arrives as an ET wall time
 * ("19:30") on an NBA date, and the day boundaries stay Eastern on purpose
 * (the 6 AM ET game date in `nba-date.ts`, ESPN's 3 AM ET fantasy day that the
 * backend's scoring period carries). Those rules, and every sort or comparison
 * on the ET strings, are left as they are. Only what is printed as a clock
 * time moves to the viewer's zone, through here.
 *
 * Every helper takes an optional `tz` (an IANA zone) so tests and
 * server-rendered text can pin one; left out, it is the browser's own.
 */

import { getTodayDate } from "./nba-date";

export const ET_ZONE = "America/New_York";

const MINUTE = 60_000;
const DAY = 86_400_000;

/**
 * The viewer's zone, as the browser reports it ("America/Chicago"). On the
 * server, which has no viewer, Eastern: what the desks printed before.
 */
export function viewerZone(): string {
  if (typeof window === "undefined") return ET_ZONE;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ET_ZONE;
  } catch {
    return ET_ZONE;
  }
}

// Building an Intl.DateTimeFormat is the slow part, and a week grid prints dozens of tips.
const formats = new Map<string, Intl.DateTimeFormat>();
function format(tz: string, kind: "wall" | "zone"): Intl.DateTimeFormat {
  const key = `${kind}|${tz}`;
  let f = formats.get(key);
  if (!f) {
    f =
      kind === "wall"
        ? new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            hourCycle: "h23",
            weekday: "short",
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" });
    formats.set(key, f);
  }
  return f;
}

interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
}

/** The wall clock in `tz` at `ms`. */
function wallAt(ms: number, tz: string): Wall {
  const p = Object.fromEntries(format(tz, "wall").formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    weekday: p.weekday,
  };
}

/** The ET wall clock at `ms`, read back as if it were UTC. */
function etWall(ms: number): number {
  const w = wallAt(ms, ET_ZONE);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM_RE = /^(\d{1,2}):(\d{2})/;

/** A real calendar date ("2026-10-20", not "2026-02-30") as [y, m, d]; null otherwise. */
function readDate(date: string | null | undefined): [number, number, number] | null {
  const d = DATE_RE.exec(date ?? "");
  if (!d) return null;
  const [y, m, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const back = new Date(Date.UTC(y, m - 1, day));
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === day ? [y, m, day] : null;
}

/** A wall clock ("19:30") as [h, m], null past 23:59. */
function readClock(hhmm: string | null | undefined): [number, number] | null {
  const t = HHMM_RE.exec(hhmm ?? "");
  if (!t) return null;
  const [h, m] = [Number(t[1]), Number(t[2])];
  return h <= 23 && m <= 59 ? [h, m] : null;
}

/** The instant of an ET wall time ("19:30") on a date ("2026-10-20"); null when either is unreadable. */
export function etInstant(date: string | null | undefined, hhmm: string | null | undefined): number | null {
  const d = readDate(date);
  const t = readClock(hhmm);
  if (!d || !t) return null;
  const wall = Date.UTC(d[0], d[1] - 1, d[2], t[0], t[1]);
  // ET is UTC−5 or UTC−4: guess the first, then correct by how far that instant's ET clock is off.
  const guess = wall + 5 * 60 * MINUTE;
  return guess + (wall - etWall(guess));
}

export interface ClockOpts {
  /** The zone to print in; the viewer's when left out. */
  tz?: string;
  /** The tight form for grid cells: "7:30P" instead of "7:30 PM". */
  compact?: boolean;
  /** Add the zone's short name: "7:30 PM CST". */
  label?: boolean;
}

function clock(hour: number, minute: number, compact: boolean | undefined): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(minute).padStart(2, "0");
  return compact ? `${h}:${mm}${hour >= 12 ? "P" : "A"}` : `${h}:${mm} ${hour >= 12 ? "PM" : "AM"}`;
}

/** The zone's short name at `ms`: "CST", "PDT", "EST", "GMT+1". */
export function zoneName(ms: number = Date.now(), tz: string = viewerZone()): string {
  try {
    const part = format(tz, "zone")
      .formatToParts(new Date(ms))
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}

function withLabel(text: string, ms: number, tz: string, label: boolean | undefined): string {
  return label ? `${text} ${zoneName(ms, tz)}` : text;
}

/** An instant as a clock in the viewer's zone: "7:30 PM" ("7:30P" compact). */
export function localClock(ms: number, opts: ClockOpts = {}): string {
  const tz = opts.tz ?? viewerZone();
  const w = wallAt(ms, tz);
  return withLabel(clock(w.hour, w.minute, opts.compact), ms, tz, opts.label);
}

/**
 * An ET tip ("19:30") on its NBA date, as the viewer's clock: "6:30 PM" in
 * Central, "6:30P" compact. Where the viewer's calendar has already moved to
 * the next day (a 7:30 PM ET tip is 1:30 AM in Paris), it says so: the long
 * form leads with the local weekday ("Wed 1:30 AM"), the compact one adds
 * "+1". Without a date it is read on today's NBA date, which only matters
 * across a daylight-saving change. Anything unreadable comes back as given.
 */
export function localTip(hhmm: string | null | undefined, date?: string | null, opts: ClockOpts = {}): string {
  if (!hhmm) return "";
  const day = readDate(date) ? date! : getTodayDate();
  const at = etInstant(day, hhmm);
  if (at == null) return hhmm;
  const tz = opts.tz ?? viewerZone();
  const w = wallAt(at, tz);
  const [y, m, d] = day.split("-").map(Number);
  const shift = Math.round((Date.UTC(w.year, w.month - 1, w.day) - Date.UTC(y, m - 1, d)) / DAY);
  let text = clock(w.hour, w.minute, opts.compact);
  if (shift !== 0) text = opts.compact ? `${text}${shift > 0 ? "+" : "−"}${Math.abs(shift)}` : `${w.weekday} ${text}`;
  return withLabel(text, at, tz, opts.label);
}

/** An instant with its local weekday: "Wed 7:00 PM". */
export function localWeekdayTime(ms: number, opts: ClockOpts = {}): string {
  const tz = opts.tz ?? viewerZone();
  const w = wallAt(ms, tz);
  return withLabel(`${w.weekday} ${clock(w.hour, w.minute, opts.compact)}`, ms, tz, opts.label);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** An instant with its local date: "Wed Oct 21, 7:00 PM". */
export function localDateTime(ms: number, opts: ClockOpts = {}): string {
  const tz = opts.tz ?? viewerZone();
  const w = wallAt(ms, tz);
  return withLabel(`${w.weekday} ${MONTHS[w.month - 1]} ${w.day}, ${clock(w.hour, w.minute, opts.compact)}`, ms, tz, opts.label);
}

/** An instant's calendar date in the viewer's zone: "2026-11-05". */
export function localDate(ms: number, tz: string = viewerZone()): string {
  const w = wallAt(ms, tz);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** An instant as a 24-hour stamp for the developer desk: "Oct 7, 2026 18:41 CDT". */
export function localStamp(ms: number, tz: string = viewerZone()): string {
  const w = wallAt(ms, tz);
  const hh = String(w.hour).padStart(2, "0");
  const mm = String(w.minute).padStart(2, "0");
  return `${MONTHS[w.month - 1]} ${w.day}, ${w.year} ${hh}:${mm} ${zoneName(ms, tz)}`;
}

// The backend's own copy ("vs LAL · 7:30 PM") prints ET clocks with `%-I:%M %p`,
// sometimes followed by " ET"; this finds them.
const ET_CLOCK_RE = /\b(\d{1,2}):(\d{2}) ?(AM|PM)( ET\b)?/g;

/**
 * Text the backend wrote with ET clock times in it (a lineup move's "vs LAL ·
 * 7:30 PM", a daily action's detail), with each clock moved to the viewer's
 * zone: "vs LAL · 6:30 PM". `date` is the NBA date the times are on. A clock
 * the backend marked " ET" keeps a zone: the viewer's. Text without a clock
 * comes back unchanged.
 */
export function localizeEtClocks(text: string, date?: string | null, opts?: Omit<ClockOpts, "compact">): string;
export function localizeEtClocks(text: string | null | undefined, date?: string | null, opts?: Omit<ClockOpts, "compact">): string | null | undefined;
export function localizeEtClocks(text: string | null | undefined, date?: string | null, opts: Omit<ClockOpts, "compact"> = {}): string | null | undefined {
  if (!text) return text;
  return text.replace(ET_CLOCK_RE, (match, h: string, m: string, ampm: string, et: string | undefined) => {
    const hour = Number(h);
    if (hour < 1 || hour > 12) return match;
    const h24 = (hour % 12) + (ampm === "PM" ? 12 : 0);
    return localTip(`${String(h24).padStart(2, "0")}:${m}`, date, { ...opts, label: opts.label || !!et });
  });
}
