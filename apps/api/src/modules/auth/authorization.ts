/**
 * Central business authorization rules (spec §3.5, §4.3, §5). Pure functions –
 * every sensitive route must call these on the server. Keep rules here, not in
 * route handlers or the frontend, so they exist exactly once.
 */
import { canSeeVisibility, type MembershipRole, type VisibilityLevel } from "@bsv-sws/shared";
import { forbidden } from "../../lib/errors.js";
import type { AuthContext } from "./auth-service.js";

/** Federation users and administrators. */
export function isFederation(ctx: AuthContext): boolean {
  return ctx.accountRole === "federation" || ctx.accountRole === "administrator";
}

export function isAdministrator(ctx: AuthContext): boolean {
  return ctx.accountRole === "administrator";
}

/** Representative of exactly this club (based on the active membership, never on input). */
export function isRepresentativeOf(ctx: AuthContext, clubId: string): boolean {
  return ctx.membership?.role === "representative" && ctx.membership.club.id === clubId;
}

/** Edit club data/logo, manage members, club events (spec §4.3, §6.3). */
export function canManageClub(ctx: AuthContext, clubId: string): boolean {
  return isFederation(ctx) || isRepresentativeOf(ctx, clubId);
}

/**
 * Invitations (spec §5): only the federation may invite representatives;
 * representatives may invite ordinary members to their own club.
 */
export function canInvite(ctx: AuthContext, clubId: string, role: MembershipRole): boolean {
  if (role === "representative") return isFederation(ctx);
  return canManageClub(ctx, clubId);
}

/** Promote/demote/remove members of a club (spec §4.4). */
export function canManageMembershipsOf(ctx: AuthContext, clubId: string): boolean {
  return canManageClub(ctx, clubId);
}

/**
 * Federation administration (Phase 7: settings, account overview, audit log).
 * Receiving notification emails grants nothing (spec §10.3) – only the account role counts.
 */
export function canAdministrate(ctx: AuthContext): boolean {
  return isFederation(ctx);
}

/** Read content of a visibility level (spec §8.4). */
export function canAccessVisibility(ctx: AuthContext | null, visibility: VisibilityLevel): boolean {
  return canSeeVisibility(ctx?.level ?? "visitor", visibility);
}

/** Throws 403 unless the condition holds. */
export function authorize(allowed: boolean, message?: string): asserts allowed {
  if (!allowed) throw forbidden(message);
}
