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
  session: "Wettkampfabschnitt",
  break: "Pause",
  awards: "Siegerehrung",
  custom: "Sonstiges",
};

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
