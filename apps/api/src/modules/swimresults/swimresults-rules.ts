import {
  EVENT_FILE_TYPE_LABELS,
  EVENT_FILE_TYPES,
  RACE_GENDERS,
  RACE_STROKES,
  type EventFileType,
  type RaceGender,
  type RaceStroke,
  type ScheduleEntryType,
} from "@bsv-sws/shared";
import type { PublicEventFile, ScheduleEntry } from "@bsv-sws/validation";
import { z } from "zod";
import { EVENT_TIME_ZONE } from "../public-calendar/timezone.js";

/**
 * Pure mapping of SwimResults API responses (meeting service) to the website's
 * schedule and file model. The SwimResults web app (github.com/SwimResults/WebApplication)
 * reads the same endpoints:
 *   - file/meeting/list/<id>    → files
 *   - event/meet/<id>/parts     → sections with races
 *   - incident/meet/<id>        → warm-up, meetings, breaks, … anchored before/after a race
 * Responses are parsed leniently: unknown fields are ignored, broken entries skipped.
 */

const loose = <T extends z.ZodRawShape>(shape: T) => z.looseObject(shape);

export const srFileSchema = loose({
  path: z.string().nullish(),
  url: z.string().nullish(),
  name: z.string(),
  extension: z.string().nullish(),
  in_file_list: z.boolean().nullish(),
  hidden: z.boolean().nullish(),
  existing: z.boolean().nullish(),
  ordering: z.number().nullish(),
  downloads: z.number().nullish(),
});
export type SrFile = z.infer<typeof srFileSchema>;

const srRaceSchema = loose({
  number: z.number(),
  distance: z.number().nullish(),
  relay_distance: z.string().nullish(),
  gender: z.string().nullish(),
  style: loose({ name: z.string().nullish(), aliases: z.array(z.string()).nullish() }).nullish(),
  final: loose({ name: z.string().nullish() }).nullish(),
  name_extension: z.string().nullish(),
  ordering: z.number().nullish(),
});

export const srPartSchema = loose({
  number: z.number().nullish(),
  events: z.array(srRaceSchema).nullish(),
});
export type SrPart = z.infer<typeof srPartSchema>;

export const srIncidentSchema = loose({
  type: z.string().nullish(),
  name: z.string(),
  name_extension: z.string().nullish(),
  start: z.string().nullish(),
  end: z.string().nullish(),
  prev_event: z.number().nullish(),
  next_event: z.number().nullish(),
});
export type SrIncident = z.infer<typeof srIncidentSchema>;

/** Parses a JSON array element by element; invalid elements are dropped. */
export function parseList<T>(schema: z.ZodType<T>, data: unknown): T[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

// --- links ---------------------------------------------------------------------

export function swimResultsLinks(appUrl: string, meetingId: string) {
  const base = `${appUrl.replace(/\/$/, "")}/m/${encodeURIComponent(meetingId)}`;
  return {
    meetingId,
    meetingUrl: base,
    liveUrl: `${base}/live?live=1`,
    resultsUrl: `${base}/event`,
    athletesUrl: `${base}/athlete`,
  };
}

// --- files ---------------------------------------------------------------------

const fileType = (name: string): EventFileType => {
  const t = name.toLowerCase();
  return (EVENT_FILE_TYPES as readonly string[]).includes(t) ? (t as EventFileType) : "other";
};

/** Fallback label for unknown file names: "SOME_FILE" → "Some file". */
const humanize = (name: string) => {
  const s = name.replace(/[_-]+/g, " ").trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * File list as shown by SwimResults: only `in_file_list` and not hidden, by
 * `ordering`. Files that do not exist yet (`existing` not true) are kept as
 * "not available yet" (e.g. results before the meet).
 */
export function toFiles(files: SrFile[], downloadUrl: string): PublicEventFile[] {
  const base = downloadUrl.replace(/\/$/, "");
  return files
    .filter((f) => f.in_file_list !== false && !f.hidden)
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (a.f.ordering ?? 0) - (b.f.ordering ?? 0) || a.i - b.i)
    .map(({ f }) => {
      const type = fileType(f.name);
      const raw =
        f.existing === true
          ? f.url || (f.path ? `${base}/${f.path.replace(/^\//, "")}` : null)
          : null;
      // Only http(s) links are rendered (no javascript: etc. from a third party).
      const url = raw && /^https?:\/\//i.test(raw) ? raw : null;
      return {
        type,
        label: type === "other" ? humanize(f.name) : EVENT_FILE_TYPE_LABELS[type],
        fileId: null,
        url,
        extension: f.extension ? f.extension.toUpperCase() : null,
        size: null,
        // Hosted files always have a counter; external links (`url`) have none (null).
        downloads: f.url ? null : (f.downloads ?? 0),
        available: !!url,
      };
    });
}

// --- schedule ------------------------------------------------------------------

const berlin = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** ISO instant → Berlin local date (YYYY-MM-DD) and time (HH:MM). */
export function toBerlin(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(berlin.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const INCIDENT_TYPES: Record<string, ScheduleEntryType> = {
  WARMUP: "warm_up",
  JUDGES_MEETING: "judges_meeting",
  TEAM_LEADER_MEETING: "team_leader_meeting",
  BREAK: "break",
  CEREMONY: "awards",
};

const ITEM_LABELS: Record<string, string> = {
  warm_up: "Einschwimmen",
  judges_meeting: "Kampfrichtersitzung",
  team_leader_meeting: "Mannschaftsleitersitzung",
  break: "Pause",
  awards: "Siegerehrung",
};

const blank = {
  number: null,
  date: null,
  time: null,
  endTime: null,
  title: null,
  description: null,
  distance: null,
  relay: null,
  stroke: null,
  gender: null,
} as const;

function incidentEntry(i: SrIncident): ScheduleEntry {
  const type = INCIDENT_TYPES[i.name.toUpperCase()] ?? "custom";
  const label = ITEM_LABELS[type] ?? humanize(i.name);
  const start = i.type === "TIMELESS" ? null : toBerlin(i.start);
  const end = i.type === "TIMELESS" ? null : toBerlin(i.end);
  return {
    ...blank,
    kind: "item",
    type,
    title: [label, i.name_extension?.trim()].filter(Boolean).join(" "),
    date: start?.date ?? null,
    time: start?.time ?? null,
    endTime: end && end.time !== start?.time ? end.time : null,
  };
}

const raceStroke = (name: string | null | undefined): RaceStroke => {
  const s = name?.toLowerCase();
  return s && (RACE_STROKES as readonly string[]).includes(s) ? (s as RaceStroke) : "other";
};

const raceGender = (g: string | null | undefined): RaceGender | null => {
  const s = g?.toLowerCase();
  return s && (RACE_GENDERS as readonly string[]).includes(s) ? (s as RaceGender) : null;
};

function raceEntry(r: z.infer<typeof srRaceSchema>): ScheduleEntry {
  const stroke = raceStroke(r.style?.name);
  const suffix = [
    stroke === "other" ? (r.style?.aliases?.[0] ?? r.style?.name) : null,
    r.name_extension?.trim(),
    r.final?.name?.trim(),
  ].filter(Boolean);
  return {
    ...blank,
    kind: "race",
    type: "custom",
    number: r.number,
    distance: r.distance ?? null,
    relay: r.relay_distance?.toLowerCase().replace(/\s+/g, "") || null,
    stroke,
    gender: raceGender(r.gender),
    title: suffix.length ? suffix.join(" ") : null,
  };
}

const byStart = (a: SrIncident, b: SrIncident) => (a.start ?? "").localeCompare(b.start ?? "");

/**
 * Builds the ordered schedule: per part a section row (date = first dated
 * incident of the part, else the day of the previous part), then its races by `ordering`, each with the incidents
 * anchored before (`next_event`) and after (`prev_event`) it. Incidents without
 * a known race come last.
 */
export function toSchedule(parts: SrPart[], incidents: SrIncident[]): ScheduleEntry[] {
  const sortedParts = [...parts]
    .filter((p) => (p.events?.length ?? 0) > 0)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  // Without races SwimResults has no meeting plan yet (manual schedule is shown).
  if (sortedParts.length === 0) return [];
  const raceNumbers = new Set(sortedParts.flatMap((p) => (p.events ?? []).map((e) => e.number)));
  const before = new Map<number, SrIncident[]>();
  const after = new Map<number, SrIncident[]>();
  const unanchored: SrIncident[] = [];
  for (const i of [...incidents].sort(byStart)) {
    if (i.next_event != null && raceNumbers.has(i.next_event)) {
      before.set(i.next_event, [...(before.get(i.next_event) ?? []), i]);
    } else if (i.prev_event != null && raceNumbers.has(i.prev_event)) {
      after.set(i.prev_event, [...(after.get(i.prev_event) ?? []), i]);
    } else {
      unanchored.push(i);
    }
  }

  const out: ScheduleEntry[] = [];
  let lastDate: string | null = null;
  for (const part of sortedParts) {
    const races = [...(part.events ?? [])].sort(
      (a, b) => (a.ordering ?? a.number) - (b.ordering ?? b.number),
    );
    const items = races.flatMap((r) => [
      ...(before.get(r.number) ?? []).map(incidentEntry),
      raceEntry(r),
      ...(after.get(r.number) ?? []).map(incidentEntry),
    ]);
    // Parts without own incidents continue on the day of the previous part.
    const date: string | null = items.find((e) => e.date)?.date ?? lastDate;
    lastDate = items.findLast((e) => e.date)?.date ?? date;
    out.push({ ...blank, kind: "section", type: "custom", number: part.number ?? null, date });
    out.push(...items);
  }
  out.push(...unanchored.map(incidentEntry));
  return out;
}
