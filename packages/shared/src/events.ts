/** Event workflow statuses (spec §7.7). */
export const EVENT_STATUSES = ["draft", "pending", "published", "rejected", "unpublished"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** The five fixed event calendars (spec §7.4). Not user-manageable. */
export const EVENT_CALENDARS = [
  "swimming",
  "water_polo",
  "artistic_swimming",
  "masters",
  "general",
] as const;
export type EventCalendar = (typeof EVENT_CALENDARS)[number];

export const EVENT_CALENDAR_LABELS: Record<EventCalendar, string> = {
  swimming: "Schwimmen",
  water_polo: "Wasserball",
  artistic_swimming: "Synchronschwimmen",
  masters: "Masters",
  general: "Allgemein",
};

/** Organizer types (spec §7.1). */
export const ORGANIZER_TYPES = ["club", "federation", "external"] as const;
export type OrganizerType = (typeof ORGANIZER_TYPES)[number];

/** Sports offered by clubs (same set as the sport calendars, without "general"). */
export const SPORTS = ["swimming", "water_polo", "artistic_swimming", "masters"] as const;
export type Sport = (typeof SPORTS)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Entwurf",
  pending: "Eingereicht",
  published: "Veröffentlicht",
  rejected: "Abgelehnt",
  unpublished: "Depubliziert",
};

export const ORGANIZER_TYPE_LABELS: Record<OrganizerType, string> = {
  club: "Verein",
  federation: "BSV-SWS",
  external: "Externe Organisation",
};

/**
 * Predefined schedule entry types (spec §7.6 hybrid model). `custom` = free entry;
 * every entry also has its own title, so other event formats are not constrained.
 */
export const SCHEDULE_ENTRY_TYPES = [
  "admission",
  "warm_up",
  "meeting",
  "judges_meeting",
  "team_leader_meeting",
  "session",
  "break",
  "awards",
  "custom",
] as const;
export type ScheduleEntryType = (typeof SCHEDULE_ENTRY_TYPES)[number];

export const SCHEDULE_ENTRY_TYPE_LABELS: Record<ScheduleEntryType, string> = {
  admission: "Einlass",
  warm_up: "Einschwimmen",
  meeting: "Sitzung / Besprechung",
  judges_meeting: "Kampfrichtersitzung",
  team_leader_meeting: "Mannschaftsleitersitzung",
  session: "Wettkampfabschnitt",
  break: "Pause",
  awards: "Siegerehrung",
  custom: "Sonstiges",
};

/**
 * Kinds of schedule rows – the same model as SwimResults (parts → races, with
 * incidents in between), stored as one ordered list:
 *   - `section`: starts a section (Abschnitt) – number, date, start time
 *   - `race`:    a race (Wettkampf) – number, distance, relay, stroke, gender
 *   - `item`:    everything else (warm-up, meetings, breaks, awards, …) – `type`
 */
export const SCHEDULE_ENTRY_KINDS = ["section", "race", "item"] as const;
export type ScheduleEntryKind = (typeof SCHEDULE_ENTRY_KINDS)[number];

export const SCHEDULE_ENTRY_KIND_LABELS: Record<ScheduleEntryKind, string> = {
  section: "Abschnitt",
  race: "Wettkampf",
  item: "Programmpunkt",
};

/** Strokes of a race (SwimResults style names, lower case). */
export const RACE_STROKES = [
  "freestyle",
  "backstroke",
  "breaststroke",
  "butterfly",
  "medley",
  "freestyle_kicks",
  "backstroke_kicks",
  "breaststroke_kicks",
  "butterfly_kicks",
  "other",
] as const;
export type RaceStroke = (typeof RACE_STROKES)[number];

export const RACE_STROKE_LABELS: Record<RaceStroke, string> = {
  freestyle: "Freistil",
  backstroke: "Rücken",
  breaststroke: "Brust",
  butterfly: "Schmetterling",
  medley: "Lagen",
  freestyle_kicks: "Kraulbeine",
  backstroke_kicks: "Rückenkraulbeine",
  breaststroke_kicks: "Brustbeine",
  butterfly_kicks: "Delfinbeine",
  other: "Sonstige",
};

export const RACE_GENDERS = ["female", "male", "mixed"] as const;
export type RaceGender = (typeof RACE_GENDERS)[number];

export const RACE_GENDER_LABELS: Record<RaceGender, string> = {
  female: "weiblich",
  male: "männlich",
  mixed: "mixed",
};

/**
 * Event file types (SwimResults file names, lower case). `other` uses the free
 * description as its label.
 */
export const EVENT_FILE_TYPES = [
  "meeting_info",
  "registration_list",
  "start_list",
  "results_list",
  "dsv_definition",
  "dsv_results",
  "lenex_definition",
  "lenex_results",
  "registration_software",
  "data_protection",
  "privacy_information",
  "overnight_stay_tickets",
  "other",
] as const;
export type EventFileType = (typeof EVENT_FILE_TYPES)[number];

export const EVENT_FILE_TYPE_LABELS: Record<EventFileType, string> = {
  meeting_info: "Ausschreibung",
  registration_list: "Meldeliste",
  start_list: "Meldeergebnis",
  results_list: "Protokoll",
  dsv_definition: "Wettkampfdefinition",
  dsv_results: "Wettkampfergebnisliste",
  lenex_definition: "LENEX-Datei",
  lenex_results: "LENEX-Ergebnisdatei",
  registration_software: "Meldeprogramm für internationale Vereine",
  data_protection: "Datenschutzerklärung",
  privacy_information: "Informationen zum Datenschutz (DSV)",
  overnight_stay_tickets: "Bestellung Übernachtung",
  other: "Sonstige Datei",
};

/** Display label of a file: its description, else the label of its type. */
export function eventFileLabel(type: EventFileType, description?: string | null): string {
  return description?.trim() || EVENT_FILE_TYPE_LABELS[type];
}

/** Removal request types (owner decision: representative chooses). */
export const REMOVAL_TYPES = ["unpublish", "delete"] as const;
export type RemovalType = (typeof REMOVAL_TYPES)[number];

export const REMOVAL_TYPE_LABELS: Record<RemovalType, string> = {
  unpublish: "Depublizieren",
  delete: "Löschen",
};

export const REMOVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type RemovalStatus = (typeof REMOVAL_STATUSES)[number];

/** URL segments of the public WebCal feeds (/kalender/<slug>.ics); "alle" = complete calendar. */
export const CALENDAR_FEED_SLUGS: Record<EventCalendar, string> = {
  swimming: "schwimmen",
  water_polo: "wasserball",
  artistic_swimming: "synchronschwimmen",
  masters: "masters",
  general: "allgemein",
};
export const ALL_EVENTS_FEED_SLUG = "alle";
