/**
 * Minimal RFC 5545 (iCalendar) writer for the public WebCal feeds (spec §7.13).
 * Pure and dependency-free; timed events are emitted in UTC (no VTIMEZONE needed).
 */
import { addDays, zonedToUtc } from "./timezone.js";

export interface IcalEvent {
  uid: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  url: string;
  categories: string[];
  lastModified: string;
}

export interface IcalCalendar {
  name: string;
  description: string;
  events: IcalEvent[];
}

/** Escapes TEXT values (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds content lines longer than 75 octets (UTF-8), never splitting a character. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const basicDate = (date: string) => date.replaceAll("-", "");
/** UTC timestamp in basic format: 20270508T070000Z */
export const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

function eventLines(e: IcalEvent): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${utcStamp(new Date(e.lastModified))}`,
    `LAST-MODIFIED:${utcStamp(new Date(e.lastModified))}`,
    `SUMMARY:${escapeText(e.title)}`,
  ];
  if (e.allDay || !e.startTime) {
    // DTEND is exclusive for DATE values.
    lines.push(
      `DTSTART;VALUE=DATE:${basicDate(e.startDate)}`,
      `DTEND;VALUE=DATE:${basicDate(addDays(e.endDate, 1))}`,
    );
  } else {
    lines.push(`DTSTART:${utcStamp(zonedToUtc(e.startDate, e.startTime))}`);
    if (e.endTime) lines.push(`DTEND:${utcStamp(zonedToUtc(e.endDate, e.endTime))}`);
    else if (e.endDate !== e.startDate)
      lines.push(`DTEND:${utcStamp(zonedToUtc(e.endDate, "23:59"))}`);
  }
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  const description = [e.description, e.url].filter(Boolean).join("\n\n");
  lines.push(`DESCRIPTION:${escapeText(description)}`, `URL:${e.url}`);
  if (e.categories.length) lines.push(`CATEGORIES:${e.categories.map(escapeText).join(",")}`);
  lines.push("STATUS:CONFIRMED", "TRANSP:OPAQUE", "END:VEVENT");
  return lines;
}

export function renderCalendar(cal: IcalCalendar): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bezirksschwimmverband Suedwestsachsen//Veranstaltungen//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(cal.name)}`,
    `X-WR-CALDESC:${escapeText(cal.description)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...cal.events.flatMap(eventLines),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
