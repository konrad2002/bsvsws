import { readItems } from "@directus/sdk";
import {
  CALENDAR_FEED_SLUGS,
  EVENT_CALENDAR_LABELS,
  EVENT_CALENDARS,
  ALL_EVENTS_FEED_SLUG,
  eventFileLabel,
  type EventCalendar,
  type EventFileType,
  type OrganizerType,
} from "@bsv-sws/shared";
import type {
  CalendarFilters,
  PublicEventDetail,
  PublicEventQuery,
  PublicEventSummary,
} from "@bsv-sws/validation";
import type { ServiceClient } from "../../lib/directus.js";
import { notFound } from "../../lib/errors.js";
import { scheduleFields, toScheduleEntry, type ScheduleRecord } from "../events/event-mapper.js";
import type { SwimResultsClient } from "../swimresults/swimresults-client.js";
import { swimResultsLinks } from "../swimresults/swimresults-rules.js";
import { renderCalendar, type IcalEvent } from "./ical.js";
import { addDays } from "./timezone.js";

/**
 * Public read model (spec §7.11–7.13). Directus public permissions cannot filter
 * by status without a licence, so public reads go through Fastify with the
 * service account and an explicit field whitelist. Only published, non-deleted
 * events with a slug are ever returned.
 */

interface PublicRow {
  id: string;
  slug: string;
  title: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  calendar: EventCalendar;
  official: boolean;
  organizer_type: OrganizerType;
  organizer_name: string | null;
  venue: string | null;
  city: string | null;
  club: { name: string; slug: string } | null;
  categories: { event_categories_id: { name: string; slug: string } | null }[];
  date_created: string | null;
  date_updated: string | null;
  // detail only
  description?: string | null;
  street?: string | null;
  postal_code?: string | null;
  website?: string | null;
  admission_info?: string | null;
  results_service?: string | null;
  swimresults_id?: string | null;
  additional_info?: string | null;
  title_image?: string | null;
  logo?: string | null;
  schedule?: Omit<ScheduleRecord, "id">[];
  files?: {
    id: string;
    type: EventFileType | null;
    description: string | null;
    file: {
      filename_download: string | null;
      type: string | null;
      filesize: number | string | null;
    } | null;
  }[];
}

const SUMMARY_FIELDS = [
  "id",
  "slug",
  "title",
  "start_date",
  "end_date",
  "all_day",
  "start_time",
  "end_time",
  "calendar",
  "official",
  "organizer_type",
  "organizer_name",
  "venue",
  "city",
  "club.name",
  "club.slug",
  "categories.event_categories_id.name",
  "categories.event_categories_id.slug",
  "date_created",
  "date_updated",
];
const DETAIL_FIELDS = [
  ...SUMMARY_FIELDS,
  "description",
  "street",
  "postal_code",
  "website",
  "admission_info",
  "results_service",
  "swimresults_id",
  "additional_info",
  "title_image",
  "logo",
  ...scheduleFields("schedule.").filter((f) => f !== "schedule.id"),
  "files.id",
  "files.type",
  "files.description",
  "files.file.filename_download",
  "files.file.type",
  "files.file.filesize",
];

/** The only rows the public may ever see. */
const PUBLISHED = {
  status: { _eq: "published" },
  deleted_at: { _null: true },
  slug: { _nnull: true },
};

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

function organizerName(row: PublicRow): string {
  if (row.organizer_type === "federation") return "BSV-SWS";
  if (row.organizer_type === "external") return row.organizer_name ?? "Externer Veranstalter";
  return row.club?.name ?? row.organizer_name ?? "Verein";
}

function toSummary(row: PublicRow): PublicEventSummary {
  return {
    slug: row.slug,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    allDay: row.all_day,
    startTime: row.all_day ? null : hhmm(row.start_time),
    endTime: row.all_day ? null : hhmm(row.end_time),
    calendar: row.calendar,
    categories: row.categories
      .map((c) => c.event_categories_id)
      .filter((c): c is { name: string; slug: string } => !!c),
    club: row.club ? { name: row.club.name, slug: row.club.slug } : null,
    organizer: organizerName(row),
    byFederation: row.organizer_type === "federation",
    venue: row.venue,
    city: row.city,
    official: row.official,
  };
}

export function createPublicEventService(deps: {
  client: ServiceClient;
  webPublicUrl: string;
  /** Optional: without it, only manually entered schedule/files are shown. */
  swimResults?: SwimResultsClient;
  swimResultsAppUrl?: string;
  now?: () => Date;
}) {
  const { client } = deps;
  const today = () => (deps.now ? deps.now() : new Date()).toISOString().slice(0, 10);
  const publicUrl = (slug: string) =>
    new URL(`/veranstaltungen/${slug}`, deps.webPublicUrl).toString();

  async function query(filter: Record<string, unknown>, fields: string[], limit: number) {
    return (await client.request(
      readItems("events", {
        filter: { ...PUBLISHED, ...filter } as never,
        fields: fields as never,
        sort: ["start_date", "start_time", "title"] as never,
        deep: { schedule: { _sort: ["sort"] }, files: { _sort: ["sort"] } } as never,
        limit,
      }),
    )) as unknown as PublicRow[];
  }

  /**
   * Schedule and files of the detail view. With a SwimResults id, SwimResults
   * replaces each section (schedule, files) that it has data for; otherwise –
   * or if SwimResults is unreachable – the manually entered data is shown.
   */
  async function scheduleAndFiles(row: PublicRow) {
    const manualSchedule = (row.schedule ?? []).map(toScheduleEntry);
    const manualFiles = (row.files ?? []).map((f) => {
      const type = f.type ?? "other";
      return {
        type,
        label: eventFileLabel(type, f.description),
        fileId: f.id,
        url: null,
        extension: f.file?.filename_download?.split(".").pop()?.toUpperCase() ?? null,
        size: f.file?.filesize != null ? Number(f.file.filesize) : null,
        downloads: null,
        available: true,
      };
    });
    const id = row.swimresults_id;
    const sr = id && deps.swimResults ? await deps.swimResults.meeting(id) : null;
    const useSchedule = !!sr?.schedule?.length;
    const useFiles = !!sr?.files?.length;
    return {
      schedule: useSchedule ? sr!.schedule! : manualSchedule,
      scheduleSource: useSchedule ? ("swimresults" as const) : ("manual" as const),
      files: useFiles ? sr!.files! : manualFiles,
      filesSource: useFiles ? ("swimresults" as const) : ("manual" as const),
      swimresults:
        id && deps.swimResultsAppUrl ? swimResultsLinks(deps.swimResultsAppUrl, id) : null,
    };
  }

  return {
    /** Events overlapping [from, to] (calendar views), optionally filtered. */
    async list(q: PublicEventQuery): Promise<PublicEventSummary[]> {
      const filter: Record<string, unknown> = {
        start_date: { _lte: q.to },
        end_date: { _gte: q.from },
      };
      if (q.calendar) filter.calendar = { _eq: q.calendar };
      if (q.club) filter.club = { slug: { _eq: q.club } };
      if (q.category) filter.categories = { event_categories_id: { slug: { _eq: q.category } } };
      return (await query(filter, SUMMARY_FIELDS, 1000)).map(toSummary);
    },

    async get(slug: string): Promise<PublicEventDetail> {
      const [row] = await query({ slug: { _eq: slug } }, DETAIL_FIELDS, 1);
      if (!row) throw notFound("Veranstaltung nicht gefunden.");
      return {
        ...toSummary(row),
        id: row.id,
        description: row.description ?? null,
        street: row.street ?? null,
        postalCode: row.postal_code ?? null,
        website: row.website ?? null,
        admissionInfo: row.admission_info ?? null,
        resultsService: row.results_service ?? null,
        swimresultsId: row.swimresults_id ?? null,
        additionalInfo: row.additional_info ?? null,
        hasTitleImage: !!row.title_image,
        hasLogo: !!row.logo,
        ...(await scheduleAndFiles(row)),
        updatedAt: (row.date_updated ?? row.date_created)!,
      };
    },

    async filters(): Promise<CalendarFilters> {
      const [categories, clubs] = await Promise.all([
        client.request(
          readItems("event_categories", {
            filter: { active: { _eq: true } },
            fields: ["name", "slug"],
            sort: ["sort", "name"],
            limit: -1,
          }),
        ),
        client.request(
          readItems("clubs", {
            filter: { active: { _eq: true } },
            fields: ["name", "slug"],
            sort: ["name"],
            limit: -1,
          }),
        ),
      ]);
      return {
        categories: categories as CalendarFilters["categories"],
        clubs: clubs as CalendarFilters["clubs"],
      };
    },

    /** WebCal feed: complete ("alle") or one of the five calendars. Past 12 months + all future events. */
    async feed(feedSlug: string): Promise<string | null> {
      const calendar = EVENT_CALENDARS.find((c) => CALENDAR_FEED_SLUGS[c] === feedSlug);
      if (!calendar && feedSlug !== ALL_EVENTS_FEED_SLUG) return null;
      const filter: Record<string, unknown> = { end_date: { _gte: addDays(today(), -365) } };
      if (calendar) filter.calendar = { _eq: calendar };
      const rows = await query(
        filter,
        [...SUMMARY_FIELDS, "description", "street", "postal_code"],
        2000,
      );
      const events: IcalEvent[] = rows.map((r) => ({
        uid: `${r.id}@bsv-sws.de`,
        title: r.title,
        startDate: r.start_date,
        endDate: r.end_date,
        allDay: r.all_day,
        startTime: hhmm(r.start_time),
        endTime: hhmm(r.end_time),
        location:
          [r.venue, r.street, [r.postal_code, r.city].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(", ") || null,
        description: r.description ?? null,
        url: publicUrl(r.slug),
        categories: [
          EVENT_CALENDAR_LABELS[r.calendar],
          ...toSummary(r).categories.map((c) => c.name),
        ],
        lastModified: r.date_updated ?? r.date_created ?? new Date().toISOString(),
      }));
      const label = calendar ? EVENT_CALENDAR_LABELS[calendar] : "Alle Veranstaltungen";
      return renderCalendar({
        name: `BSV-SWS – ${label}`,
        description: `Veranstaltungen des Bezirksschwimmverbands Südwestsachsen (${label})`,
        events,
      });
    },
  };
}

export type PublicEventService = ReturnType<typeof createPublicEventService>;
