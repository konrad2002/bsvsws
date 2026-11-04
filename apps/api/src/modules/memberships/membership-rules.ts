import type { MembershipRole } from "@bsv-sws/shared";
import { conflict, forbidden } from "../../lib/errors.js";
import type { AuthContext } from "../auth/auth-service.js";
import { authorize, canManageMembershipsOf, isFederation } from "../auth/authorization.js";

export interface MembershipTarget {
  userId: string;
  clubId: string;
  role: MembershipRole;
}

/**
 * Owner decision: representatives can never demote or remove themselves; only
 * another representative of the club or the federation can (spec §4.4 + decision log).
 */
function assertNotSelf(ctx: AuthContext, target: MembershipTarget, message: string) {
  if (!isFederation(ctx) && target.userId === ctx.id)
    throw forbidden(message, "SELF_CHANGE_NOT_ALLOWED");
}

/** Promote (member → representative) or demote (representative → member). */
export function assertCanChangeRole(
  ctx: AuthContext,
  target: MembershipTarget,
  newRole: MembershipRole,
) {
  authorize(canManageMembershipsOf(ctx, target.clubId));
  assertNotSelf(ctx, target, "Du kannst deine eigene Rolle nicht ändern.");
  if (target.role === newRole) {
    throw conflict("ROLE_UNCHANGED", "Die Person hat diese Rolle bereits.");
  }
}

/**
 * Spec §19.7 / §4.4: the configurable maximum binds representatives promoting
 * members; the federation may override representative assignments. Null = unlimited.
 */
export function assertWithinRepresentativeLimit(
  ctx: AuthContext,
  newRole: MembershipRole,
  limit: { current: number; max: number | null },
) {
  if (newRole !== "representative" || isFederation(ctx) || limit.max === null) return;
  if (limit.current >= limit.max) {
    throw conflict(
      "REPRESENTATIVE_LIMIT_REACHED",
      `Ein Verein kann höchstens ${limit.max} Vereinsvertreter haben. Wende dich an den Verband, wenn ihr mehr braucht.`,
      { max: limit.max },
    );
  }
}

/** Remove a user from the club (membership ends, account stays – spec §4.4). */
export function assertCanRemove(ctx: AuthContext, target: MembershipTarget) {
  authorize(canManageMembershipsOf(ctx, target.clubId));
  assertNotSelf(ctx, target, "Du kannst dich nicht selbst aus dem Verein entfernen.");
}

export function roleChangeAction(
  newRole: MembershipRole,
): "membership.promoted" | "membership.demoted" {
  return newRole === "representative" ? "membership.promoted" : "membership.demoted";
}
