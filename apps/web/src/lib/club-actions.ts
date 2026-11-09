"use server";

import type { MembershipRole } from "@bsv-sws/shared";
import { clubSchema, invitationLinkResultSchema, uuidSchema } from "@bsv-sws/validation";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formText, toActionError, type ActionState } from "./action-state";
import { apiFetch, jsonBody } from "./api";

/**
 * Server actions for club, membership and invitation management. They only
 * forward to Fastify, which authorizes every call (frontend checks are cosmetic).
 */

const REP_FIELDS = [
  "shortName",
  "description",
  "website",
  "email",
  "phone",
  "street",
  "postalCode",
  "city",
  "venue",
] as const;

function clubInputFromForm(form: FormData, federation: boolean) {
  const input: Record<string, unknown> = {};
  for (const field of REP_FIELDS) {
    const value = formText(form, field);
    if (value !== undefined) input[field] = value;
  }
  input.sports = form.getAll("sports").map(String);
  if (federation) {
    input.name = formText(form, "name") ?? "";
    input.slug = formText(form, "slug") ?? "";
    input.active = form.get("active") === "on";
  }
  return input;
}

export async function createClubAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string;
  try {
    const club = clubSchema.parse(
      await apiFetch("/clubs", { method: "POST", body: jsonBody(clubInputFromForm(form, true)) }),
    );
    id = club.id;
  } catch (error) {
    return toActionError(error);
  }
  redirect(`/intern/verband/vereine/${id}`);
}

export async function updateClubAction(
  clubId: string,
  federation: boolean,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await apiFetch(`/clubs/${uuidSchema.parse(clubId)}`, {
      method: "PATCH",
      body: jsonBody(clubInputFromForm(form, federation)),
    });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "Gespeichert." };
}

export async function uploadLogoAction(
  clubId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Bitte eine Datei auswählen." };
  if (file.size > 2 * 1024 * 1024) return { error: "Das Logo darf höchstens 2 MB groß sein." };
  const body = new FormData();
  body.append("file", file, file.name);
  try {
    await apiFetch(`/clubs/${uuidSchema.parse(clubId)}/logo`, { method: "PUT", body });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: "Logo gespeichert." };
}

export async function removeLogoAction(clubId: string): Promise<ActionState> {
  try {
    await apiFetch(`/clubs/${uuidSchema.parse(clubId)}/logo`, { method: "DELETE" });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true };
}

export interface InviteResult {
  email: string;
  link: string;
  emailSent: boolean;
}

export async function inviteAction(
  clubId: string,
  _prev: ActionState<InviteResult>,
  form: FormData,
): Promise<ActionState<InviteResult>> {
  try {
    const result = invitationLinkResultSchema.parse(
      await apiFetch(`/clubs/${uuidSchema.parse(clubId)}/invitations`, {
        method: "POST",
        body: jsonBody({
          email: formText(form, "email") ?? "",
          role: formText(form, "role") ?? "member",
          sendEmail: form.get("sendEmail") === "on",
        }),
      }),
    );
    refresh();
    return {
      ok: true,
      data: { email: result.invitation.email, link: result.link, emailSent: result.emailSent },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function resendInvitationAction(
  invitationId: string,
  sendEmail: boolean,
): Promise<ActionState<InviteResult>> {
  try {
    const result = invitationLinkResultSchema.parse(
      await apiFetch(`/invitations/${uuidSchema.parse(invitationId)}/resend`, {
        method: "POST",
        body: jsonBody({ sendEmail }),
      }),
    );
    refresh();
    return {
      ok: true,
      data: { email: result.invitation.email, link: result.link, emailSent: result.emailSent },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionState> {
  try {
    await apiFetch(`/invitations/${uuidSchema.parse(invitationId)}/revoke`, { method: "POST" });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true };
}

export async function changeRoleAction(
  membershipId: string,
  role: MembershipRole,
): Promise<ActionState> {
  try {
    await apiFetch(`/memberships/${uuidSchema.parse(membershipId)}`, {
      method: "PATCH",
      body: jsonBody({ role }),
    });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true };
}

export async function removeMemberAction(membershipId: string): Promise<ActionState> {
  try {
    await apiFetch(`/memberships/${uuidSchema.parse(membershipId)}`, { method: "DELETE" });
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true };
}
