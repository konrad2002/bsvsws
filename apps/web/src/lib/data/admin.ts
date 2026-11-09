import "server-only";
import {
  accountSummarySchema,
  appSettingsSchema,
  auditLogEntrySchema,
  paginatedSchema,
  type AccountFilter,
} from "@bsv-sws/validation";
import { apiFetch } from "../api";

/** Federation administration (Phase 7). Fastify authorizes every call. */

export async function getSettings() {
  return appSettingsSchema.parse(await apiFetch("/admin/settings"));
}

export async function listAccounts(query: { q?: string; filter: AccountFilter; page: number }) {
  const params = new URLSearchParams({ filter: query.filter, page: String(query.page) });
  if (query.q) params.set("q", query.q);
  return paginatedSchema(accountSummarySchema).parse(await apiFetch(`/admin/accounts?${params}`));
}

export async function listAuditLog(query: { action?: string; club?: string; page: number }) {
  const params = new URLSearchParams({ page: String(query.page) });
  if (query.action) params.set("action", query.action);
  if (query.club) params.set("club", query.club);
  return paginatedSchema(auditLogEntrySchema).parse(await apiFetch(`/admin/audit-log?${params}`));
}
