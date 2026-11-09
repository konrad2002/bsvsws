import type { EventFileRow, EventRow, EventScheduleEntryRow } from "@bsv-sws/directus";
import type {
  EventCreateInput,
  EventDetail,
  EventSummary,
  EventUpdateInput,
  RemovalRequest,
  ScheduleEntry,
} from "@bsv-sws/validation";
import type { EventState } from "./event-rules.js";

/** Directus row with the relations the service reads. */
export type EventRecord = Omit<EventRow, "club"> & {
  club: { id: string; name: string } | null;
  categories?: { event_categories_id: { id: number; name: string } | null }[];
  schedule?: ScheduleRecord[];
  files?: (Pick<EventFileRow, "id" | "type" | "description"> & {
    file: {
      id: string;
      filename_download: string | null;
      type: string | null;
      filesize: number | string | null;
    } | null;
  })[];
};

export type ScheduleRecord = Omit<EventScheduleEntryRow, "event" | "sort">;

/** Directus fields of a schedule row (relational prefix, e.g. "schedule."). */
export const scheduleFields = (prefix: string) =>
  [
    "id",
    "kind",
    "number",
    "date",
    "time",
    "end_time",
    "type",
    "title",
    "description",
    "distance",
    "relay",
    "stroke",
    "gender",
  ].map((f) => prefix + f);

export function toScheduleEntry(s: Omit<ScheduleRecord, "id">): ScheduleEntry {
  return {
    kind: s.kind ?? "item",
    number: s.number,
    date: s.date,
    time: hhmm(s.time),
    endTime: hhmm(s.end_time),
    type: s.type ?? "custom",
    title: s.title,
    description: s.description,
    distance: s.distance,
    relay: s.relay,
    stroke: s.stroke,
    gender: s.gender,
  };
}

export interface RemovalRecord {
  id: string;
  event: string | { id: string; title: string };
  type: "unpublish" | "delete";
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requested_by:
    string | { first_name: string | null; last_name: string | null; email: string | null } | null;
  decision_comment: string | null;
  date_created: string | null;
}

export const SUMMARY_FIELDS = [
  "id",
  "title",
  "status",
  "start_date",
  "end_date",
  "calendar",
  "club.id",
  "club.name",
  "official",
  "deleted_at",
  "date_created",
  "date_updated",
  "published_at",
  "submitted_by",
  "slug",
];

export const DETAIL_FIELDS = [
  ...SUMMARY_FIELDS,
  "description",
  "all_day",
  "start_time",
  "end_time",
  "organizer_type",
  "organizer_name",
  "venue",
  "street",
  "postal_code",
  "city",
  "website",
  "title_image",
  "logo",
  "admission_info",
  "results_service",
  "swimresults_id",
  "additional_info",
  "submitted_at",
  "review_comment",
  "categories.event_categories_id.id",
  "categories.event_categories_id.name",
  ...scheduleFields("schedule."),
  "files.id",
  "files.type",
  "files.description",
  "files.file.id",
  "files.file.filename_download",
  "files.file.type",
  "files.file.filesize",
];

/** Directus returns HH:MM:SS. */
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

export const versionOf = (row: Pick<EventRow, "date_updated" | "date_created">) =>
  (row.date_updated ?? row.date_created ?? new Date(0).toISOString()) as string;

export function stateOf(row: EventRecord, hasPendingRemoval: boolean): EventState {
  return {
    status: row.status,
    clubId: row.club?.id ?? null,
    deleted: !!row.deleted_at,
    publishedAt: row.published_at,
    hasPendingRemoval,
  };
}

export function toSummary(row: EventRecord, hasPendingRemoval: boolean): EventSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    calendar: row.calendar,
    club: row.club ? { id: row.club.id, name: row.club.name } : null,
    official: row.official,
    deleted: !!row.deleted_at,
    hasPendingRemoval,
    updatedAt: versionOf(row),
  };
}

export function toRemoval(r: RemovalRecord): RemovalRequest {
  const by =
    typeof r.requested_by === "object" && r.requested_by
      ? [r.requested_by.first_name, r.requested_by.last_name].filter(Boolean).join(" ") ||
        r.requested_by.email
      : null;
  return {
    id: r.id,
    type: r.type,
    reason: r.reason,
    status: r.status,
    requestedAt: r.date_created,
    requestedBy: by,
    decisionComment: r.decision_comment,
  };
}

/** Comparable camelCase view of the scalar fields (for locked-field checks and audit diffs). */
export function comparable(row: EventRecord) {
  return {
    title: row.title,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    allDay: row.all_day,
    startTime: hhmm(row.start_time),
    endTime: hhmm(row.end_time),
    calendar: row.calendar,
    organizerType: row.organizer_type,
    organizerName: row.organizer_name,
    venue: row.venue,
    street: row.street,
    postalCode: row.postal_code,
    city: row.city,
    website: row.website,
    admissionInfo: row.admission_info,
    resultsService: row.results_service,
    swimresultsId: row.swimresults_id,
    additionalInfo: row.additional_info,
    official: row.official,
    clubId: row.club?.id ?? null,
  };
}

export function toDetail(
  row: EventRecord,
  pendingRemoval: RemovalRecord | null,
  extras: Pick<EventDetail, "allowedActions" | "lockedFields">,
): EventDetail {
  const c = comparable(row);
  return {
    ...toSummary(row, !!pendingRemoval),
    description: c.description,
    allDay: c.allDay,
    startTime: c.startTime,
    endTime: c.endTime,
    organizerType: c.organizerType,
    organizerName: c.organizerName,
    venue: c.venue,
    street: c.street,
    postalCode: c.postalCode,
    city: c.city,
    website: c.website,
    admissionInfo: c.admissionInfo,
    resultsService: c.resultsService,
    swimresultsId: c.swimresultsId,
    additionalInfo: c.additionalInfo,
    titleImage: row.title_image,
    logo: row.logo,
    categories: (row.categories ?? [])
      .map((c) => c.event_categories_id)
      .filter((c): c is { id: number; name: string } => !!c),
    schedule: (row.schedule ?? []).map((s) => ({ id: s.id, ...toScheduleEntry(s) })),
    files: (row.files ?? []).map((f) => ({
      id: f.id,
      type: f.type ?? "other",
      description: f.description,
      filename: f.file?.filename_download ?? null,
      mimeType: f.file?.type ?? null,
      size: f.file?.filesize != null ? Number(f.file.filesize) : null,
    })),
    reviewComment: row.review_comment,
    submittedAt: row.submitted_at,
    publishedAt: row.published_at,
    pendingRemoval: pendingRemoval ? toRemoval(pendingRemoval) : null,
    ...extras,
  };
}

const COLUMNS: Partial<Record<keyof EventCreateInput, keyof EventRow>> = {
  title: "title",
  description: "description",
  startDate: "start_date",
  endDate: "end_date",
  allDay: "all_day",
  startTime: "start_time",
  endTime: "end_time",
  calendar: "calendar",
  organizerType: "organizer_type",
  organizerName: "organizer_name",
  venue: "venue",
  street: "street",
  postalCode: "postal_code",
  city: "city",
  website: "website",
  admissionInfo: "admission_info",
  resultsService: "results_service",
  swimresultsId: "swimresults_id",
  additionalInfo: "additional_info",
  official: "official",
  clubId: "club",
};

/** Builds the Directus payload; categories and schedule are replaced via nested writes. */
export function toRow(input: EventUpdateInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(COLUMNS)) {
    const value = (input as Record<string, unknown>)[key];
    if (value !== undefined) row[column] = value;
  }
  if (input.allDay === true) {
    row.start_time = null;
    row.end_time = null;
  }
  if (input.categoryIds)
    row.categories = input.categoryIds.map((id) => ({ event_categories_id: id }));
  if (input.schedule) {
    row.schedule = input.schedule.map((s, i) => ({
      kind: s.kind,
      number: s.number,
      date: s.date,
      time: s.time,
      end_time: s.endTime,
      type: s.type,
      title: s.title,
      description: s.description,
      distance: s.distance,
      relay: s.relay,
      stroke: s.stroke,
      gender: s.gender,
      sort: i + 1,
    }));
  }
  return row;
}
