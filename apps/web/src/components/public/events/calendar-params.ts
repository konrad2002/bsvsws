import { CALENDAR_FEED_SLUGS, EVENT_CALENDARS, type EventCalendar } from "@bsv-sws/shared";

/**
 * URL parameters of /veranstaltungen (German, readable):
 *   ansicht = liste | monat | jahr, monat = YYYY-MM, jahr = YYYY, zeitraum = vergangen,
 *   kalender = schwimmen | wasserball | …, verein = <club slug>, kategorie = <category slug>
 */
export type CalendarView = "liste" | "monat" | "jahr";

export interface CalendarParams {
  ansicht: CalendarView;
  monat?: string;
  jahr?: string;
  zeitraum?: "vergangen";
  kalender?: string;
  verein?: string;
  kategorie?: string;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const slug = (v: string | undefined) => (v && /^[a-z0-9-]{1,80}$/.test(v) ? v : undefined);

export function parseCalendarParams(
  raw: Record<string, string | string[] | undefined>,
): CalendarParams {
  const ansicht = first(raw.ansicht);
  return {
    ansicht: ansicht === "monat" || ansicht === "jahr" ? ansicht : "liste",
    monat: first(raw.monat),
    jahr: first(raw.jahr),
    zeitraum: first(raw.zeitraum) === "vergangen" ? "vergangen" : undefined,
    kalender: slug(first(raw.kalender)),
    verein: slug(first(raw.verein)),
    kategorie: slug(first(raw.kategorie)),
  };
}

export function calendarFromSlug(feedSlug: string | undefined): EventCalendar | undefined {
  return EVENT_CALENDARS.find((c) => CALENDAR_FEED_SLUGS[c] === feedSlug);
}

/** Builds a /veranstaltungen URL, keeping the filters and overriding the given params. */
export function calendarHref(params: CalendarParams, override: Partial<CalendarParams>): string {
  const merged = { ...params, ...override };
  const search = new URLSearchParams();
  if (merged.ansicht !== "liste") search.set("ansicht", merged.ansicht);
  if (merged.ansicht === "monat" && merged.monat) search.set("monat", merged.monat);
  if (merged.ansicht === "jahr" && merged.jahr) search.set("jahr", merged.jahr);
  if (merged.ansicht === "liste" && merged.zeitraum) search.set("zeitraum", merged.zeitraum);
  for (const key of ["kalender", "verein", "kategorie"] as const)
    if (merged[key]) search.set(key, merged[key]!);
  const qs = search.toString();
  return `/veranstaltungen${qs ? `?${qs}` : ""}`;
}
