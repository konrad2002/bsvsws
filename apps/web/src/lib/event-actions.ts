"use server";

import { eventDetailSchema, uuidSchema } from "@bsv-sws/validation";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formText, toActionError, type ActionState } from "./action-state";
import { apiFetch, jsonBody } from "./api";
import { getCurrentUser } from "./auth/current-user";

/**
 * Server actions for events. They forward to Fastify, which enforces the
 * workflow (statuses, locked fields, roles). UI restrictions are cosmetic.
 */

const TEXT_FIELDS = [
  "title",
  "description",
  "startDate",
  "endDate",
  "startTime",
  "endTime",
  "calendar",
  "organizerType",
  "organizerName",
  "venue",
  "street",
  "postalCode",
  "city",
  "website",
  "admissionInfo",
  "resultsService",
  "swimresultsId",
  "additionalInfo",
] as const;

async function eventPayload(form: FormData) {
  const user = await getCurrentUser();
  const federation = user?.level === "federation" || user?.level === "administrator";
  const payload: Record<string, unknown> = {};
  for (const field of TEXT_FIELDS) {
    const value = formText(form, field);
    if (value !== undefined) payload[field] = value; // disabled (locked) inputs are not submitted
  }
  payload.allDay = form.get("allDay") === "on";
  payload.categoryIds = form.getAll("categoryIds").map(Number).filter(Number.isInteger);
  const schedule = formText(form, "scheduleJson");
  if (schedule !== undefined) payload.schedule = JSON.parse(schedule || "[]");
  if (federation) {
    payload.official = form.get("official") === "on";
    const clubId = formText(form, "clubId");
    if (clubId !== undefined) payload.clubId = clubId === "" ? null : clubId;
  }
  return payload;
}

export async function createEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string;
  try {
    const event = eventDetailSchema.parse(
      await apiFetch("/events", { method: "POST", body: jsonBody(await eventPayload(form)) }),
    );
    id = event.id;
  } catch (error) {
    return toActionError(error);
  }
  redirect(`/intern/veranstaltungen/${id}`);
}

export async function updateEventAction(
  eventId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await apiFetch(`/events/${uuidSchema.parse(eventId)}`, {
      method: "PATCH",
      body: jsonBody(await eventPayload(form)),
    });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "Gespeichert." };
}

type WorkflowAction =
  | "submit"
  | "approve"
  | "reject"
  | "publish"
  | "unpublish"
  | "removal-request"
  | "removal-decision";

export async function eventWorkflowAction(
  eventId: string,
  action: WorkflowAction,
  body: Record<string, unknown> = {},
): Promise<ActionState> {
  try {
    await apiFetch(`/events/${uuidSchema.parse(eventId)}/${action}`, {
      method: "POST",
      body: jsonBody(body),
    });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true };
}

export async function deleteEventAction(eventId: string, comment?: string): Promise<ActionState> {
  try {
    await apiFetch(`/events/${uuidSchema.parse(eventId)}`, {
      method: "DELETE",
      body: jsonBody({ comment }),
    });
  } catch (error) {
    return toActionError(error);
  }
  redirect("/intern/veranstaltungen");
}

export async function uploadEventFileAction(
  eventId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const file = form.get("file");
  const description = formText(form, "description")?.trim() ?? "";
  if (!(file instanceof File) || file.size === 0) return { error: "Bitte eine Datei auswählen." };
  if (!description) return { fieldErrors: { description: ["Bitte eine Beschreibung angeben."] } };
  if (file.size > 20 * 1024 * 1024) return { error: "Die Datei darf höchstens 20 MB groß sein." };
  const body = new FormData();
  body.append("description", description); // must precede the file part
  body.append("file", file, file.name);
  try {
    await apiFetch(`/events/${uuidSchema.parse(eventId)}/files`, { method: "POST", body });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "Datei hinzugefügt." };
}

export async function removeEventFileAction(eventId: string, fileId: string): Promise<ActionState> {
  try {
    await apiFetch(`/events/${uuidSchema.parse(eventId)}/files/${uuidSchema.parse(fileId)}`, {
      method: "DELETE",
    });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true };
}

export async function setEventImageAction(
  eventId: string,
  kind: "title_image" | "logo",
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Bitte ein Bild auswählen." };
  if (file.size > 5 * 1024 * 1024) return { error: "Das Bild darf höchstens 5 MB groß sein." };
  const body = new FormData();
  body.append("file", file, file.name);
  try {
    await apiFetch(`/events/${uuidSchema.parse(eventId)}/images/${kind}`, { method: "PUT", body });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "Bild gespeichert." };
}

export async function removeEventImageAction(
  eventId: string,
  kind: "title_image" | "logo",
): Promise<ActionState> {
  try {
    await apiFetch(`/events/${uuidSchema.parse(eventId)}/images/${kind}`, { method: "DELETE" });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true };
}
