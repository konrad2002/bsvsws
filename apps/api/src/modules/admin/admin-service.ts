import { aggregate, readItems, readSingleton, readUsers, updateSingleton } from "@directus/sdk";
import { DIRECTUS_ROLE_IDS, DIRECTUS_SERVICE_USER_ID } from "@bsv-sws/directus";
import type {
  AccountFilter,
  AccountSummary,
  AppSettings,
  AuditLogEntry,
  Paginated,
} from "@bsv-sws/validation";
import type { ServiceClient } from "../../lib/directus.js";
import type { AuditService } from "../audit/audit-service.js";
import type { AuthContext } from "../auth/auth-service.js";
import { authorize, canAdministrate } from "../auth/authorization.js";
import {
  ADMIN_PAGE_SIZE,
  byName,
  displayName,
  matchesAccountFilter,
  matchesSearch,
  paginate,
  settingsChanges,
  toAccountSummary,
  toAppSettings,
  type ActiveMembershipRow,
  type SettingsRow,
  type UserRow,
} from "./admin-rules.js";

const SETTINGS_FIELDS = [
  "representative_joined_recipients",
  "event_review_recipients",
  "max_representatives_per_club",
  "date_updated",
];

interface AuditRow {
  id: number | string;
  timestamp: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  actor: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  club: { id: string; name: string } | null;
  changes: AuditLogEntry["changes"];
  comment: string | null;
  context: Record<string, unknown> | null;
}

/**
 * Federation administration (spec §17 Phase 7). Every method authorizes the
 * ORIGINAL user (`canAdministrate`); the service account only does the I/O.
 */
export function createAdminService({
  client,
  audit,
}: {
  client: ServiceClient;
  audit: AuditService;
}) {
  async function readSettings(): Promise<AppSettings> {
    const row = (await client.request(
      readSingleton("notification_settings", { fields: SETTINGS_FIELDS as never }),
    )) as unknown as SettingsRow | null;
    return toAppSettings(row);
  }

  return {
    /** Unauthenticated internal use (limits, recipients) – never expose directly. */
    readSettings,

    async getSettings(ctx: AuthContext): Promise<AppSettings> {
      authorize(canAdministrate(ctx));
      return readSettings();
    },

    async updateSettings(
      ctx: AuthContext,
      input: Omit<AppSettings, "updatedAt">,
    ): Promise<AppSettings> {
      authorize(canAdministrate(ctx));
      const before = await readSettings();
      const changes = settingsChanges(before, input);
      if (!changes) return before;
      await client.request(
        updateSingleton("notification_settings", {
          representative_joined_recipients: input.representativeJoinedRecipients,
          event_review_recipients: input.eventReviewRecipients,
          max_representatives_per_club: input.maxRepresentativesPerClub,
        } as never),
      );
      await audit.record({
        actor: ctx.id,
        action: "settings.updated",
        entityType: "notification_settings",
        entityId: "singleton",
        changes,
      });
      return readSettings();
    },

    /**
     * All accounts with their active membership. The data set is small (a few
     * hundred club users), so search/filter/pagination run in memory on one
     * consistent snapshot instead of N relational Directus queries.
     */
    async listAccounts(
      ctx: AuthContext,
      query: { q?: string; filter: AccountFilter; page: number },
    ): Promise<Paginated<AccountSummary>> {
      authorize(canAdministrate(ctx));
      const [users, memberships] = await Promise.all([
        client.request(
          readUsers({
            filter: {
              id: { _neq: DIRECTUS_SERVICE_USER_ID },
              _or: [{ role: { _null: true } }, { role: { _neq: DIRECTUS_ROLE_IDS.apiService } }],
            },
            fields: ["id", "email", "first_name", "last_name", "status", "role", "last_access"],
            limit: -1,
          }),
        ) as unknown as Promise<UserRow[]>,
        client.request(
          readItems("club_memberships", {
            filter: { status: { _eq: "active" } },
            fields: ["user", "role", "club.id", "club.name"] as never,
            limit: -1,
          }),
        ) as unknown as Promise<ActiveMembershipRow[]>,
      ]);
      const byUser = new Map(memberships.map((m) => [m.user, m]));
      const accounts = users
        .map((u) => toAccountSummary(u, byUser.get(u.id)))
        .filter((a) => matchesAccountFilter(a, query.filter) && matchesSearch(a, query.q))
        .sort(byName);
      return paginate(accounts, query.page);
    },

    /** Application audit log (spec §4.5), newest first. */
    async listAuditLog(
      ctx: AuthContext,
      query: { action?: string; club?: string; page: number },
    ): Promise<Paginated<AuditLogEntry>> {
      authorize(canAdministrate(ctx));
      const filter: Record<string, unknown> = {};
      if (query.action) {
        filter.action = query.action.includes(".")
          ? { _eq: query.action }
          : { _starts_with: `${query.action}.` };
      }
      if (query.club) filter.club = { _eq: query.club };
      const [rows, counted] = await Promise.all([
        client.request(
          readItems("audit_logs", {
            filter,
            fields: [
              "id",
              "timestamp",
              "action",
              "entity_type",
              "entity_id",
              "actor.id",
              "actor.first_name",
              "actor.last_name",
              "actor.email",
              "club.id",
              "club.name",
              "changes",
              "comment",
              "context",
            ] as never,
            sort: ["-timestamp", "-id"] as never,
            limit: ADMIN_PAGE_SIZE,
            page: query.page,
          }),
        ) as unknown as Promise<AuditRow[]>,
        client.request(
          aggregate(
            "audit_logs" as never,
            { aggregate: { count: "*" }, query: { filter } } as never,
          ),
        ) as unknown as Promise<{ count: string | number }[]>,
      ]);
      const total = Number(counted[0]?.count ?? 0);
      return {
        items: rows.map((r) => ({
          id: Number(r.id),
          timestamp: r.timestamp,
          action: r.action,
          entityType: r.entity_type,
          entityId: r.entity_id,
          actor: r.actor ? { id: r.actor.id, name: displayName(r.actor) } : null,
          club: r.club ? { id: r.club.id, name: r.club.name } : null,
          changes: r.changes,
          comment: r.comment,
          context: r.context,
        })),
        page: query.page,
        pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
        total,
      };
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
