import "server-only";
import { navigationSchema, pageSchema } from "@bsv-sws/validation";
import { cache } from "react";
import { ApiRequestError, apiFetch } from "../api";

/** Menus as seen by the logged-in user (incl. "Interner Bereich"). Deduplicated per request. */
export const getInternalNavigation = cache(async () =>
  navigationSchema.parse(await apiFetch("/internal/navigation")),
);

/** Internal page: returns `forbidden` for insufficient level (owner decision: 403), null if missing. */
export async function getInternalPage(path: string) {
  try {
    return {
      page: pageSchema.parse(await apiFetch(`/internal/pages?path=${encodeURIComponent(path)}`)),
    };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 403)
      return { forbidden: true as const };
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}
