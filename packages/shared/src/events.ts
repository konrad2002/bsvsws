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
