import { createItem } from "@directus/sdk";
import type { FastifyBaseLogger } from "fastify";
import type { ServiceClient } from "../../lib/directus.js";

export interface AuditEntry {
  /** Original user (never the service account). Null for system actions. */
  actor: string | null;
  /** Dot notation, e.g. `membership.promoted` – list in docs/05-workflows.md. */
  action: string;
  entityType: string;
  entityId: string;
  club?: string | null;
  changes?: { before?: unknown; after?: unknown } | null;
  comment?: string | null;
  context?: Record<string, unknown> | null;
}

export interface AuditService {
  record(entry: AuditEntry): Promise<void>;
}

/**
 * Writes to the explicit application audit log (spec §4.5). Called AFTER the
 * audited operation succeeded. Directus has no cross-request transactions, so a
 * failed audit write cannot roll back the operation: it is retried once and then
 * logged at error level (with the full entry) so it can be reconstructed.
 */
export function createAuditService(client: ServiceClient, log: FastifyBaseLogger): AuditService {
  return {
    async record(entry) {
      const payload = {
        actor: entry.actor,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        club: entry.club ?? null,
        changes: entry.changes ?? null,
        comment: entry.comment ?? null,
        context: entry.context ?? null,
      };
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await client.request(createItem("audit_logs", payload as never));
          return;
        } catch (error) {
          if (attempt === 2) log.error({ err: error, audit: payload }, "AUDIT LOG WRITE FAILED");
        }
      }
    },
  };
}
