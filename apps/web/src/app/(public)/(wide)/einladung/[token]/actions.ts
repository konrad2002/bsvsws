"use server";

import {
  invitationRegisterSchema,
  invitationTokenSchema,
  verificationCodeSchema,
} from "@bsv-sws/validation";
import { redirect } from "next/navigation";
import { toActionError, type ActionState } from "@/lib/action-state";
import { apiFetch, jsonBody } from "@/lib/api";

const path = (token: string, suffix = "") =>
  `/invitations/by-token/${encodeURIComponent(invitationTokenSchema.parse(token))}${suffix}`;

export async function registerAction(
  token: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (form.get("password") !== form.get("passwordRepeat")) {
    return { fieldErrors: { passwordRepeat: ["Die Passwörter stimmen nicht überein."] } };
  }
  const parsed = invitationRegisterSchema.safeParse({
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    password: form.get("password"),
    phone: form.get("phone") ?? "",
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await apiFetch(path(token, "/register"), { method: "POST", body: jsonBody(parsed.data) });
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function verifyAction(
  token: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = verificationCodeSchema.safeParse({ code: form.get("code") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  let email: string;
  try {
    ({ email } = await apiFetch<{ email: string }>(path(token, "/verify"), {
      method: "POST",
      body: jsonBody(parsed.data),
    }));
  } catch (error) {
    return toActionError(error);
  }
  redirect(`/login?registriert=1&email=${encodeURIComponent(email)}`);
}

export async function resendCodeAction(token: string): Promise<ActionState> {
  try {
    await apiFetch(path(token, "/resend-code"), { method: "POST" });
    return { ok: true, message: "Ein neuer Code wurde gesendet." };
  } catch (error) {
    return toActionError(error);
  }
}

export async function acceptAction(token: string, _prev: ActionState): Promise<ActionState> {
  try {
    await apiFetch(path(token, "/accept"), { method: "POST" });
  } catch (error) {
    return toActionError(error);
  }
  redirect("/intern");
}
