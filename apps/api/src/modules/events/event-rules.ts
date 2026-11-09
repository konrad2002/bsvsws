/**
 * Event workflow rules (spec §7.7–7.11 + owner decisions in docs/decisions).
 * Pure functions: the single place that decides who may do what in which status.
 */
import type { EventStatus } from "@bsv-sws/shared";
import { LOCKED_AFTER_PUBLISH, type EventAction, type EventUpdateInput } from "@bsv-sws/validation";
import { AppError, conflict, forbidden } from "../../lib/errors.js";
import type { AuthContext } from "../auth/auth-service.js";
import { isFederation, isRepresentativeOf } from "../auth/authorization.js";

export interface EventState {
  status: EventStatus;
  clubId: string | null;
  deleted: boolean;
  /** First publication; never-published events may be discarded by their club. */
  publishedAt: string | null;
  hasPendingRemoval: boolean;
}

/** Status transitions. Edits never change the status (owner decision: pending stays editable). */
export const TRANSITIONS = {
  submit: { from: ["draft", "rejected", "unpublished"], to: "pending" },
  approve: { from: ["pending"], to: "published" },
  reject: { from: ["pending"], to: "rejected" },
  publish: { from: ["draft", "rejected", "unpublished"], to: "published" },
  unpublish: { from: ["published"], to: "unpublished" },
} as const satisfies Record<string, { from: readonly EventStatus[]; to: EventStatus }>;
export type TransitionAction = keyof typeof TRANSITIONS;

/** Representative of the club that owns the event. */
export function isOwner(ctx: AuthContext, ev: Pick<EventState, "clubId">): boolean {
  return !!ev.clubId && isRepresentativeOf(ctx, ev.clubId);
}

/** Spec §7.11 visibility; federation also sees soft-deleted events (archive). */
export function canViewEvent(ctx: AuthContext | null, ev: EventState): boolean {
  if (ctx && isFederation(ctx)) return true;
  if (ev.deleted) return false;
  if (ev.status === "published") return true;
  return !!ctx && isOwner(ctx, ev);
}

/** Actions the caller may perform right now (drives the UI; enforced via assertAction). */
export function allowedActions(ctx: AuthContext, ev: EventState): EventAction[] {
  if (ev.deleted) return [];
  const fed = isFederation(ctx);
  const owner = isOwner(ctx, ev);
  const can = (from: readonly EventStatus[]) => from.includes(ev.status);
  const actions: EventAction[] = [];
  if (fed || owner) actions.push("edit");
  if ((fed || owner) && can(TRANSITIONS.submit.from)) actions.push("submit");
  if (fed && can(TRANSITIONS.approve.from)) actions.push("approve", "reject");
  if (fed && can(TRANSITIONS.publish.from)) actions.push("publish");
  if (fed && can(TRANSITIONS.unpublish.from)) actions.push("unpublish");
  if (owner && !fed && ev.status === "published" && !ev.hasPendingRemoval)
    actions.push("requestRemoval");
  if (fed && ev.hasPendingRemoval) actions.push("decideRemoval");
  if (owner && !fed && (ev.status === "draft" || ev.status === "rejected") && !ev.publishedAt)
    actions.push("discard");
  if (fed) actions.push("delete");
  return actions;
}

/** 403 if the caller has no role for the action at all, 409 if only the status is wrong. */
export function assertAction(ctx: AuthContext, ev: EventState, action: EventAction): void {
  if (allowedActions(ctx, ev).includes(action)) return;
  const involved = isFederation(ctx) || isOwner(ctx, ev);
  if (!involved || ev.deleted) throw forbidden();
  throw conflict("INVALID_STATUS", "Diese Aktion ist im aktuellen Status nicht möglich.", {
    status: ev.status,
    action,
  });
}

/** Fields the caller may not change in the current status (spec §7.9). */
export function lockedFields(ctx: AuthContext, ev: EventState): string[] {
  return !isFederation(ctx) && ev.status === "published" ? [...LOCKED_AFTER_PUBLISH] : [];
}

/**
 * Representatives may not change locked fields of published events (title,
 * start/end date). Sending the unchanged value is fine. Federation may override.
 */
export function assertNoLockedChanges(
  ctx: AuthContext,
  ev: EventState,
  current: Record<string, unknown>,
  input: EventUpdateInput,
): void {
  const changed = lockedFields(ctx, ev).filter((field) => {
    const next = (input as Record<string, unknown>)[field];
    return next !== undefined && next !== current[field];
  });
  if (changed.length > 0) {
    throw new AppError(
      403,
      "LOCKED_FIELDS",
      "Titel und Datum veröffentlichter Veranstaltungen sind gesperrt.",
      {
        fields: changed,
      },
    );
  }
}

/** Federation-only inputs: `official`, `clubId`, organizer "BSV-SWS". */
export function assertFieldPermissions(ctx: AuthContext, input: EventUpdateInput): void {
  if (isFederation(ctx)) return;
  const disallowed: string[] = [];
  if (input.official !== undefined) disallowed.push("official");
  if (input.clubId !== undefined) disallowed.push("clubId");
  if (input.organizerType === "federation") disallowed.push("organizerType");
  if (disallowed.length > 0) {
    throw new AppError(403, "FIELDS_NOT_ALLOWED", "Diese Angaben darf nur der Verband setzen.", {
      fields: disallowed,
    });
  }
}

/** Optimistic concurrency for reviews: the decision must refer to the version the reviewer saw. */
export function assertVersion(currentVersion: string, expected: string): void {
  if (new Date(currentVersion).getTime() !== new Date(expected).getTime()) {
    throw conflict(
      "EVENT_CHANGED",
      "Die Veranstaltung wurde inzwischen geändert. Bitte prüfe die aktuelle Fassung erneut.",
    );
  }
}
