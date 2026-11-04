/** Pure calendar helpers for the public views (dates as YYYY-MM-DD strings, no time zones). */

export const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
export const WEEKDAYS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today in Europe/Berlin as YYYY-MM-DD. */
export function todayInBerlin(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(now);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "2027-05" → { year, month }, falling back to `fallback` for invalid input. */
export function parseMonth(
  value: string | undefined,
  fallback: string,
): { year: number; month: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? "") ?? /^(\d{4})-(\d{2})/.exec(fallback)!;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function parseYear(value: string | undefined, fallback: number): number {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallback;
}

export function monthRange(year: number, month: number) {
  return { from: isoDate(year, month, 1), to: isoDate(year, month, daysInMonth(year, month)) };
}

export function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export const monthKey = (year: number, month: number) => `${year}-${pad(month)}`;

export interface GridDay {
  date: string;
  day: number;
  inMonth: boolean;
}

/** Weeks (Monday first) covering the whole month, padded with neighbouring days. */
export function monthGrid(year: number, month: number): GridDay[][] {
  const first = isoDate(year, month, 1);
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  let cursor = addDays(first, -weekday);
  const last = isoDate(year, month, daysInMonth(year, month));
  const weeks: GridDay[][] = [];
  while (cursor <= last || weeks.length === 0 || weeks[weeks.length - 1]!.length < 7) {
    const week: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        date: cursor,
        day: Number(cursor.slice(8)),
        inMonth: cursor.slice(0, 7) === first.slice(0, 7),
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    if (cursor > last) break;
  }
  return weeks;
}

/** Maps each day in [from, to] to the events running on it (multi-day events appear on every day). */
export function eventsByDay<T extends { startDate: string; endDate: string }>(
  events: T[],
  from: string,
  to: string,
) {
  const map = new Map<string, T[]>();
  for (const e of events) {
    let day = e.startDate < from ? from : e.startDate;
    const end = e.endDate > to ? to : e.endDate;
    while (day <= end) {
      map.set(day, [...(map.get(day) ?? []), e]);
      day = addDays(day, 1);
    }
  }
  return map;
}
