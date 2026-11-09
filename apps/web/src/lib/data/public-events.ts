import "server-only";
import {
  calendarFiltersSchema,
  publicEventDetailSchema,
  publicEventSummarySchema,
  type PublicEventQuery,
} from "@bsv-sws/validation";
import { headers } from "next/headers";
import { z } from "zod";
import { publicFetch, publicJson as json } from "../public-api";

export async function listPublicEvents(query: PublicEventQuery) {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.calendar) params.set("calendar", query.calendar);
  if (query.club) params.set("club", query.club);
  if (query.category) params.set("category", query.category);
  return z.array(publicEventSummarySchema).parse(await json(`/public/events?${params}`));
}

/** Returns null if the event does not exist or is not published. */
export async function getPublicEvent(slug: string) {
  const data = await json(`/public/events/${encodeURIComponent(slug)}`);
  return data ? publicEventDetailSchema.parse(data) : null;
}

export async function getCalendarFilters() {
  return calendarFiltersSchema.parse(await json("/public/calendar-filters"));
}

export async function fetchCalendarFeed(feed: string): Promise<Response> {
  return publicFetch(`/public/calendar/${encodeURIComponent(feed)}.ics`);
}

/** Base URL of this site as seen by the visitor (for webcal:// links). */
export async function siteOrigin(): Promise<{ host: string; protocol: string }> {
  const h = await headers();
  return {
    host: h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000",
    protocol: h.get("x-forwarded-proto") ?? "http",
  };
}
