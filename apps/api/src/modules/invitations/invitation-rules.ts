import type { InvitationStatus } from "@bsv-sws/directus";
import type { InvitationDisplayStatus } from "@bsv-sws/validation";
import { conflict, gone } from "../../lib/errors.js";

/** Verification code: lifetime and allowed wrong attempts per code. */
export const VERIFICATION_CODE_TTL_MS = 15 * 60_000;
export const MAX_VERIFICATION_ATTEMPTS = 5;

interface InvitationState {
  status: InvitationStatus;
  expires_at: string;
}

/** "Expired" is derived: pending + expires_at in the past (no background job needed). */
export function invitationDisplayStatus(inv: InvitationState, now: Date): InvitationDisplayStatus {
  if (inv.status === "pending" && new Date(inv.expires_at).getTime() <= now.getTime()) {
    return "expired";
  }
  return inv.status;
}

/** Throws unless the invitation can still be used for registration/acceptance. */
export function assertInvitationUsable(inv: InvitationState, now: Date): void {
  switch (invitationDisplayStatus(inv, now)) {
    case "pending":
      return;
    case "expired":
      throw gone(
        "INVITATION_EXPIRED",
        "Diese Einladung ist abgelaufen. Bitte fordere eine neue an.",
      );
    case "accepted":
      throw conflict("INVITATION_USED", "Diese Einladung wurde bereits angenommen.");
    case "revoked":
      throw gone("INVITATION_REVOKED", "Diese Einladung wurde zurückgezogen.");
  }
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function inviteLink(webPublicUrl: string, token: string): string {
  return new URL(`/einladung/${token}`, webPublicUrl).toString();
}
