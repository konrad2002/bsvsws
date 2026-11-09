"use server";

import { refresh } from "next/cache";
import { formText, toActionError, type ActionState } from "./action-state";
import { apiFetch, jsonBody } from "./api";

/** One address per line (or separated by comma/semicolon); empty lines are ignored. */
const recipients = (form: FormData, name: string) =>
  (formText(form, name) ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export async function updateSettingsAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const max = (formText(form, "maxRepresentativesPerClub") ?? "").trim();
  try {
    await apiFetch("/admin/settings", {
      method: "PUT",
      body: jsonBody({
        representativeJoinedRecipients: recipients(form, "representativeJoinedRecipients"),
        eventReviewRecipients: recipients(form, "eventReviewRecipients"),
        maxRepresentativesPerClub: max === "" ? null : Number(max),
      }),
    });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "Einstellungen gespeichert." };
}
