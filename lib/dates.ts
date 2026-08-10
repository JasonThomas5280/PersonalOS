/**
 * All date math lives here (CLAUDE.md). Dates are DATE columns stored at UTC
 * midnight; every helper works in UTC and ignores time-of-day.
 */

export const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" or a Date → Date at UTC midnight. */
export function toUTCDate(v: string | Date): Date {
  if (v instanceof Date) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error(`Unparseable date: ${v}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Today at UTC midnight (pass `now` for determinism in tests/engine). */
export function todayUTC(now: Date = new Date()): Date {
  return toUTCDate(now);
}

/** Date → "YYYY-MM-DD". */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((toUTCDate(b).getTime() - toUTCDate(a).getTime()) / DAY_MS);
}

/** Whole days since `d` as of `now` (positive when d is in the past). */
export function daysSince(d: Date, now: Date): number {
  return daysBetween(d, now);
}

/** Whole days until `d` as of `now` (negative when d is in the past). */
export function daysUntil(d: Date, now: Date): number {
  return daysBetween(now, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(toUTCDate(d).getTime() + n * DAY_MS);
}

/** Monday of the week containing `d`, at UTC midnight (week-start key). */
export function weekStart(d: Date): Date {
  const u = toUTCDate(d);
  const dow = u.getUTCDay(); // 0 = Sunday
  return addDays(u, dow === 0 ? -6 : 1 - dow);
}
