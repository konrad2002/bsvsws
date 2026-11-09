import { REPRESENTATIVE_CLUB_FIELDS, type ClubUpdateInput } from "@bsv-sws/validation";
import { forbidden } from "../../lib/errors.js";
import type { AuthContext } from "../auth/auth-service.js";
import { authorize, canManageClub, isFederation } from "../auth/authorization.js";

/**
 * Club edits (spec §6.2/6.3): federation may change every field; representatives
 * only their own club and only REPRESENTATIVE_CLUB_FIELDS (owner decision: not
 * name, slug, active). Disallowed fields are rejected explicitly, not ignored.
 */
export function assertCanUpdateClub(ctx: AuthContext, clubId: string, input: ClubUpdateInput) {
  authorize(canManageClub(ctx, clubId));
  if (isFederation(ctx)) return;
  const disallowed = Object.keys(input).filter((f) => !REPRESENTATIVE_CLUB_FIELDS.includes(f));
  if (disallowed.length > 0) {
    throw Object.assign(
      forbidden("Diese Felder darf nur der Verband ändern.", "FIELDS_NOT_ALLOWED"),
      { details: { fields: disallowed } },
    );
  }
}

/** Returns only the fields whose value actually changes (for the audit log). */
export function diffFields<T extends Record<string, unknown>>(before: T, update: Partial<T>) {
  const changedBefore: Partial<T> = {};
  const changedAfter: Partial<T> = {};
  for (const key of Object.keys(update) as (keyof T)[]) {
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(update[key] ?? null)) {
      changedBefore[key] = before[key];
      changedAfter[key] = update[key];
    }
  }
  return {
    before: changedBefore,
    after: changedAfter,
    changed: Object.keys(changedAfter).length > 0,
  };
}
