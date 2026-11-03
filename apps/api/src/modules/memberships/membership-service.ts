import { readItem, readItems, updateItem } from "@directus/sdk";
import type { MembershipRole } from "@bsv-sws/shared";
import type { ClubMember } from "@bsv-sws/validation";
import type { ServiceClient } from "../../lib/directus.js";
import { isNotFoundOrForbidden } from "../../lib/directus-errors.js";
import { notFound } from "../../lib/errors.js";
import type { AuditService } from "../audit/audit-service.js";
import type { AuthContext } from "../auth/auth-service.js";
import { authorize, canManageMembershipsOf } from "../auth/authorization.js";
import {
  assertCanChangeRole,
  assertCanRemove,
  roleChangeAction,
  type MembershipTarget,
} from "./membership-rules.js";

interface MembershipRow {
  id: string;
  role: MembershipRole;
  status: "active" | "ended";
  started_at: string;
  club: string;
  user: { id: string; first_name: string | null; last_name: string | null; email: string };
}

const FIELDS = [
  "id",
  "role",
  "status",
  "started_at",
  "club",
  "user.id",
  "user.first_name",
  "user.last_name",
  "user.email",
];

const toMember = (row: MembershipRow): ClubMember => ({
  membershipId: row.id,
  userId: row.user.id,
  firstName: row.user.first_name,
  lastName: row.user.last_name,
  email: row.user.email,
  role: row.role,
  startedAt: row.started_at,
});

export function createMembershipService({
  client,
  audit,
  now = () => new Date(),
}: {
  client: ServiceClient;
  audit: AuditService;
  now?: () => Date;
}) {
  async function loadActive(id: string): Promise<MembershipRow> {
    let row: MembershipRow;
    try {
      row = (await client.request(
        readItem("club_memberships", id, { fields: FIELDS as never }),
      )) as unknown as MembershipRow;
    } catch (error) {
      if (isNotFoundOrForbidden(error)) throw notFound("Mitgliedschaft nicht gefunden.");
      throw error;
    }
    if (row.status !== "active") throw notFound("Mitgliedschaft nicht gefunden.");
    return row;
  }

  const target = (row: MembershipRow): MembershipTarget => ({
    userId: row.user.id,
    clubId: row.club,
    role: row.role,
  });

  return {
    async listMembers(ctx: AuthContext, clubId: string): Promise<ClubMember[]> {
      authorize(canManageMembershipsOf(ctx, clubId));
      const rows = (await client.request(
        readItems("club_memberships", {
          filter: { club: { _eq: clubId }, status: { _eq: "active" } },
          fields: FIELDS as never,
          limit: -1,
        }),
      )) as unknown as MembershipRow[];
      return rows
        .map(toMember)
        .sort((a, b) =>
          `${a.lastName ?? ""} ${a.firstName ?? ""}`.localeCompare(
            `${b.lastName ?? ""} ${b.firstName ?? ""}`,
            "de",
          ),
        );
    },

    /** Promote or demote (spec §4.4). The membership stays active. */
    async changeRole(
      ctx: AuthContext,
      membershipId: string,
      role: MembershipRole,
    ): Promise<ClubMember> {
      const row = await loadActive(membershipId);
      assertCanChangeRole(ctx, target(row), role);
      await client.request(updateItem("club_memberships", membershipId, { role } as never));
      await audit.record({
        actor: ctx.id,
        action: roleChangeAction(role),
        entityType: "club_memberships",
        entityId: membershipId,
        club: row.club,
        changes: { before: { role: row.role }, after: { role } },
        context: { user: row.user.id },
      });
      return toMember({ ...row, role });
    },

    /**
     * Removes a user from the club: membership ends (kept as history), the
     * account stays active and may join another club later (spec §4.4).
     */
    async remove(ctx: AuthContext, membershipId: string): Promise<void> {
      const row = await loadActive(membershipId);
      assertCanRemove(ctx, target(row));
      await client.request(
        updateItem("club_memberships", membershipId, {
          status: "ended",
          active_user: null, // releases the "one active membership" unique slot
          ended_at: now().toISOString(),
          end_reason: "removed",
          ended_by: ctx.id,
        } as never),
      );
      await audit.record({
        actor: ctx.id,
        action: "membership.removed",
        entityType: "club_memberships",
        entityId: membershipId,
        club: row.club,
        changes: { before: { status: "active", role: row.role }, after: { status: "ended" } },
        context: { user: row.user.id },
      });
    },
  };
}

export type MembershipService = ReturnType<typeof createMembershipService>;
