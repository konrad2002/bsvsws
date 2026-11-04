import "server-only";
import type { EventStatus } from "@bsv-sws/shared";
import {
  eventCategorySchema,
  eventDetailSchema,
  eventHistoryEntrySchema,
  eventSummarySchema,
  reviewQueueSchema,
} from "@bsv-sws/validation";
import { z } from "zod";
import { apiFetch } from "../api";

export async function listEvents(
  filter: { status?: EventStatus; deleted?: boolean; clubId?: string } = {},
) {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.deleted) params.set("deleted", "true");
  if (filter.clubId) params.set("clubId", filter.clubId);
  return z.array(eventSummarySchema).parse(await apiFetch(`/events?${params}`));
}

export async function getEvent(id: string) {
  return eventDetailSchema.parse(await apiFetch(`/events/${id}`));
}

export async function getEventHistory(id: string) {
  return z.array(eventHistoryEntrySchema).parse(await apiFetch(`/events/${id}/history`));
}

export async function listEventCategories() {
  return z.array(eventCategorySchema).parse(await apiFetch("/event-categories"));
}

export async function getReviewQueue() {
  return reviewQueueSchema.parse(await apiFetch("/events/review"));
}
