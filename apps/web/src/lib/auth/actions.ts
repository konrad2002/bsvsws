"use server";

import { loginSchema } from "@bsv-sws/validation";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { FailureLimiter } from "../rate-limit";
import { safeRedirectPath } from "../safe-redirect";
import {
  ACCESS_COOKIE,
  directusLogin,
  directusLogout,
  REFRESH_COOKIE,
  sessionCookies,
} from "./tokens";

export interface LoginState {
  error?: string;
  email?: string;
}

// Failed logins only. Directus additionally suspends an account after repeated
// failures (settings.auth_login_attempts).
const ipLimiter = new FailureLimiter(20, 15 * 60_000);
const emailLimiter = new FailureLimiter(5, 15 * 60_000);

/** Client IP as forwarded by the reverse proxy (only trustworthy behind our own proxy). */
async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Bitte E-Mail-Adresse und Passwort eingeben.", email };

  const ip = await clientIp();
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${parsed.data.email}`;
  if (ipLimiter.isBlocked(ipKey) || emailLimiter.isBlocked(emailKey)) {
    return { error: "Zu viele Anmeldeversuche. Bitte versuche es in 15 Minuten erneut.", email };
  }

  let tokens;
  try {
    tokens = await directusLogin(parsed.data.email, parsed.data.password);
  } catch {
    ipLimiter.recordFailure(ipKey);
    emailLimiter.recordFailure(emailKey);
    // Deliberately generic: do not reveal whether the account exists or is suspended.
    return { error: "Anmeldung fehlgeschlagen. Bitte E-Mail-Adresse und Passwort prüfen.", email };
  }
  emailLimiter.reset(emailKey);

  const store = await cookies();
  for (const c of sessionCookies(tokens)) store.set(c.name, c.value, c.options);
  redirect(safeRedirectPath(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (refreshToken) await directusLogout(refreshToken);
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect("/");
}
