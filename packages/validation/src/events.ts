import {
  EVENT_CALENDARS,
  EVENT_STATUSES,
  ORGANIZER_TYPES,
  REMOVAL_STATUSES,
  REMOVAL_TYPES,
  SCHEDULE_ENTRY_TYPES,
} from "@bsv-sws/shared";
import { z } from "zod";
import { uuidSchema } from "./common.js";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const dateSchema = z.iso.date({ error: "Bitte ein gültiges Datum angeben." });
/** HH:MM (24h). Empty → null. */
const timeSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v.slice(0, 5)))
  .pipe(
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Uhrzeit im Format HH:MM.")
      .nullable(),
  )
  .nullable()
  .optional();

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(
    z
      .url({ protocol: /^https?$/, error: "Bitte eine gültige Web-Adresse (https://…) angeben." })
      .nullable(),
  )
  .nullable()
  .optional();

export const scheduleEntrySchema = z.object({
  date: dateSchema.nullable().optional(),
  time: timeSchema,
  endTime: timeSchema,
  type: z.enum(SCHEDULE_ENTRY_TYPES).default("custom"),
  title: z.string().trim().min(1, "Bitte einen Titel angeben.").max(255),
  description: optionalText(2000),
});
export type ScheduleEntryInput = z.infer<typeof scheduleEntrySchema>;

/** Editable event fields (spec §7.2). Cross-field rules: see `eventFieldRules` / Fastify. */
export const eventFieldsSchema = z.object({
  title: z.string().trim().min(3, "Bitte einen Titel angeben.").max(255),
  description: optionalText(20_000),
  startDate: dateSchema,
  endDate: dateSchema,
  allDay: z.boolean(),
  startTime: timeSchema,
  endTime: timeSchema,
  calendar: z.enum(EVENT_CALENDARS, { error: "Bitte einen Kalender wählen." }),
  organizerType: z.enum(ORGANIZER_TYPES),
  organizerName: optionalText(255),
  venue: optionalText(255),
  street: optionalText(255),
  postalCode: optionalText(10),
  city: optionalText(255),
  website: optionalUrl,
  admissionInfo: optionalText(5000),
  resultsService: optionalText(255),
  swimresultsId: optionalText(100),
  additionalInfo: optionalText(10_000),
  categoryIds: z.array(z.number().int().positive()).max(20).default([]),
  schedule: z.array(scheduleEntrySchema).max(100).default([]),
  /** Federation only. */
  official: z.boolean().optional(),
  /** Owning club. Federation only (representatives always create for their own club). */
  clubId: uuidSchema.nullable().optional(),
});

export const eventCreateSchema = eventFieldsSchema;
export type EventCreateInput = z.infer<typeof eventCreateSchema>;

export const eventUpdateSchema = eventFieldsSchema.partial().strict();
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;

/** Fields representatives may not change once the event is published (spec §7.9). */
export const LOCKED_AFTER_PUBLISH = ["title", "startDate", "endDate"] as const;

export interface EventDateFields {
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  organizerType: (typeof ORGANIZER_TYPES)[number];
  organizerName?: string | null;
  clubId?: string | null;
}

/**
 * Cross-field rules on the complete (merged) event. Returns field errors in the
 * same shape as z.flattenError().fieldErrors, empty when valid.
 */
export function eventFieldRules(e: EventDateFields): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const add = (field: string, msg: string) => (errors[field] ??= []).push(msg);
  if (e.endDate < e.startDate) add("endDate", "Das Enddatum darf nicht vor dem Startdatum liegen.");
  if (!e.allDay && !e.startTime)
    add("startTime", "Bitte eine Startzeit angeben oder „ganztägig“ wählen.");
  if (
    !e.allDay &&
    e.startTime &&
    e.endTime &&
    e.startDate === e.endDate &&
    e.endTime < e.startTime
  ) {
    add("endTime", "Die Endzeit darf nicht vor der Startzeit liegen.");
  }
  if (e.organizerType === "external" && !e.organizerName)
    add("organizerName", "Bitte den Veranstalter angeben.");
  if (e.organizerType === "club" && !e.clubId)
    add("organizerType", "Für „Verein“ als Veranstalter muss ein Verein zugeordnet sein.");
  return errors;
}

// --- workflow actions ------------------------------------------------------------

/** `version` = the event's `updatedAt` the reviewer saw (optimistic concurrency). */
export const eventReviewSchema = z.object({
  version: z.string().min(1),
  comment: z.string().trim().max(5000).optional(),
});
export const eventRejectSchema = eventReviewSchema.extend({
  comment: z.string().trim().min(3, "Bitte einen Ablehnungsgrund angeben.").max(5000),
});
export const eventCommentSchema = z.object({ comment: z.string().trim().max(5000).optional() });

export const removalRequestSchema = z.object({
  type: z.enum(REMOVAL_TYPES),
  reason: z.string().trim().min(3, "Bitte eine Begründung angeben.").max(5000),
});
export const removalDecisionSchema = z.object({
  approve: z.boolean(),
  comment: z.string().trim().max(5000).optional(),
});

// --- responses --------------------------------------------------------------------

export const scheduleEntrySchemaOut = z.object({
  id: uuidSchema,
  date: z.string().nullable(),
  time: z.string().nullable(),
  endTime: z.string().nullable(),
  type: z.enum(SCHEDULE_ENTRY_TYPES),
  title: z.string(),
  description: z.string().nullable(),
});

export const eventFileSchema = z.object({
  id: uuidSchema,
  description: z.string(),
  filename: z.string().nullable(),
  type: z.string().nullable(),
  size: z.number().nullable(),
});
export type EventFile = z.infer<typeof eventFileSchema>;

export const removalRequestOutSchema = z.object({
  id: uuidSchema,
  type: z.enum(REMOVAL_TYPES),
  reason: z.string().nullable(),
  status: z.enum(REMOVAL_STATUSES),
  requestedAt: z.string().nullable(),
  requestedBy: z.string().nullable(),
  decisionComment: z.string().nullable(),
});
export type RemovalRequest = z.infer<typeof removalRequestOutSchema>;

export const EVENT_ACTIONS = [
  "edit",
  "submit",
  "approve",
  "reject",
  "publish",
  "unpublish",
  "requestRemoval",
  "decideRemoval",
  "discard",
  "delete",
] as const;
export type EventAction = (typeof EVENT_ACTIONS)[number];

export const eventSummarySchema = z.object({
  id: uuidSchema,
  /** Public URL segment, set on first publication. */
  slug: z.string().nullable(),
  title: z.string(),
  status: z.enum(EVENT_STATUSES),
  startDate: z.string(),
  endDate: z.string(),
  calendar: z.enum(EVENT_CALENDARS),
  club: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  official: z.boolean(),
  deleted: z.boolean(),
  hasPendingRemoval: z.boolean(),
  updatedAt: z.string(),
});
export type EventSummary = z.infer<typeof eventSummarySchema>;

export const eventDetailSchema = eventSummarySchema.extend({
  description: z.string().nullable(),
  allDay: z.boolean(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  organizerType: z.enum(ORGANIZER_TYPES),
  organizerName: z.string().nullable(),
  venue: z.string().nullable(),
  street: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  website: z.string().nullable(),
  admissionInfo: z.string().nullable(),
  resultsService: z.string().nullable(),
  swimresultsId: z.string().nullable(),
  additionalInfo: z.string().nullable(),
  titleImage: uuidSchema.nullable(),
  logo: uuidSchema.nullable(),
  categories: z.array(z.object({ id: z.number(), name: z.string() })),
  schedule: z.array(scheduleEntrySchemaOut),
  files: z.array(eventFileSchema),
  reviewComment: z.string().nullable(),
  submittedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  pendingRemoval: removalRequestOutSchema.nullable(),
  /** Computed for the caller – the UI shows buttons accordingly, Fastify enforces. */
  allowedActions: z.array(z.enum(EVENT_ACTIONS)),
  lockedFields: z.array(z.string()),
});
export type EventDetail = z.infer<typeof eventDetailSchema>;

export const eventCategorySchema = z.object({ id: z.number(), name: z.string(), slug: z.string() });
export type EventCategory = z.infer<typeof eventCategorySchema>;

export const eventHistoryEntrySchema = z.object({
  id: z.number(),
  action: z.string(),
  at: z.string().nullable(),
  actorName: z.string().nullable(),
  comment: z.string().nullable(),
  changedFields: z.array(z.string()),
});
export type EventHistoryEntry = z.infer<typeof eventHistoryEntrySchema>;

export const reviewQueueSchema = z.object({
  pendingEvents: z.array(eventSummarySchema),
  pendingRemovals: z.array(
    removalRequestOutSchema.extend({ event: z.object({ id: uuidSchema, title: z.string() }) }),
  ),
});
export type ReviewQueue = z.infer<typeof reviewQueueSchema>;

// --- public calendar (Phase 4) ---------------------------------------------------------

/** Query of the public event list. Range is required and bounded (calendar views). */
export const publicEventQuerySchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    calendar: z.enum(EVENT_CALENDARS).optional(),
    club: z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .optional(),
    category: z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .optional(),
  })
  .refine((q) => q.to >= q.from, { message: "Ungültiger Zeitraum.", path: ["to"] })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 400, {
    message: "Zeitraum zu groß (max. 400 Tage).",
    path: ["to"],
  });
export type PublicEventQuery = z.infer<typeof publicEventQuerySchema>;

/** Public view of an event: no workflow/internal fields (spec §7.11, Phase 4 "no private data"). */
export const publicEventSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  allDay: z.boolean(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  calendar: z.enum(EVENT_CALENDARS),
  categories: z.array(z.object({ name: z.string(), slug: z.string() })),
  club: z.object({ name: z.string(), slug: z.string() }).nullable(),
  /** Display name of the organizer (club name, "BSV-SWS" or external name). */
  organizer: z.string(),
  /** Organised by the federation itself (BSV-SWS) – highlighted in lists and calendars. */
  byFederation: z.boolean(),
  venue: z.string().nullable(),
  city: z.string().nullable(),
  official: z.boolean(),
});
export type PublicEventSummary = z.infer<typeof publicEventSummarySchema>;

export const publicEventDetailSchema = publicEventSummarySchema.extend({
  /** Needed for public file/image URLs. */
  id: uuidSchema,
  description: z.string().nullable(),
  street: z.string().nullable(),
  postalCode: z.string().nullable(),
  website: z.string().nullable(),
  admissionInfo: z.string().nullable(),
  resultsService: z.string().nullable(),
  swimresultsId: z.string().nullable(),
  additionalInfo: z.string().nullable(),
  hasTitleImage: z.boolean(),
  hasLogo: z.boolean(),
  schedule: z.array(scheduleEntrySchemaOut.omit({ id: true })),
  files: z.array(eventFileSchema),
  updatedAt: z.string(),
});
export type PublicEventDetail = z.infer<typeof publicEventDetailSchema>;

export const calendarFiltersSchema = z.object({
  categories: z.array(z.object({ name: z.string(), slug: z.string() })),
  clubs: z.array(z.object({ name: z.string(), slug: z.string() })),
});
export type CalendarFilters = z.infer<typeof calendarFiltersSchema>;
