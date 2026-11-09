import "server-only";
import { sessionUserSchema, type SessionUser } from "@bsv-sws/validation";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ApiRequestError, apiFetch } from "../api";

/**
 * Data access layer for the current user. Returns null when not logged in or the
 * session is invalid. Deduplicated per request. Use for display and navigation
 * only – Fastify re-checks authorization on every sensitive request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  try {
    return sessionUserSchema.parse(await apiFetch("/me"));
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) return null;
    throw error;
  }
});

/** Redirects to the login page when there is no valid session. */
export async function requireUser(returnTo = "/intern"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}
