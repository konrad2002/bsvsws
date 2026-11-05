import {
  createItem,
  deleteItem,
  readItem,
  readItems,
  readSingleton,
  readUser,
  updateItem,
  uploadFiles,
} from "@directus/sdk";
import { eventFileLabel, slugify, type EventStatus } from "@bsv-sws/shared";
import {
  eventFieldRules,
  type EventCategory,
  type EventCreateInput,
  type EventDetail,
  type EventFileMeta,
  type EventHistoryEntry,
  type EventSummary,
  type EventUpdateInput,
  type ReviewQueue,
} from "@bsv-sws/validation";
import type { FastifyBaseLogger } from "fastify";
import type { ServiceClient } from "../../lib/directus.js";
import { isNotFoundOrForbidden, uniqueViolationField } from "../../lib/directus-errors.js";
import { AppError, badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import type { Mailer } from "../../lib/mailer.js";
import type { AuditService } from "../audit/audit-service.js";
import type { AuthContext } from "../auth/auth-service.js";
import { authorize, isFederation, isRepresentativeOf } from "../auth/authorization.js";
import { diffFields } from "../clubs/club-rules.js";
import {
  eventDecisionEmail,
  eventSubmittedEmail,
  removalDecidedEmail,
  removalRequestedEmail,
} from "../notifications/templates.js";
import {
  comparable,
  DETAIL_FIELDS,
  stateOf,
  SUMMARY_FIELDS,
  toDetail,
  toRemoval,
  toRow,
  toSummary,
  versionOf,
  type EventRecord,
  type RemovalRecord,
} from "./event-mapper.js";
import {
  allowedActions,
  assertAction,
  assertFieldPermissions,
  assertNoLockedChanges,
  assertVersion,
  canViewEvent,
  lockedFields,
  TRANSITIONS,
} from "./event-rules.js";

/** Documents attached to events (no taxonomy, spec §7.2) – common office/PDF/image types only. */
export const EVENT_FILE_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/plain",
  "text/csv",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/webp",
];
export const EVENT_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const EVENT_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const EVENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export type EventImageKind = "title_image" | "logo";

export interface UploadedFile {
  filename: string;
  mimetype: string;
  data: Buffer;
}

export interface EventServiceDeps {
  client: ServiceClient;
  audit: AuditService;
  mailer: Mailer;
  log: FastifyBaseLogger;
  webPublicUrl: string;
  directusUrl: string;
  serviceToken: string;
  now?: () => Date;
}

export function createEventService(deps: EventServiceDeps) {
  const { client, audit, mailer, log } = deps;
  const now = () => (deps.now ? deps.now() : new Date()).toISOString();

  // --- loading -------------------------------------------------------------------

  async function loadRow(id: string, fields = DETAIL_FIELDS): Promise<EventRecord> {
    try {
      return (await client.request(
        readItem("events", id, {
          fields: fields as never,
          deep: { schedule: { _sort: ["sort"] }, files: { _sort: ["sort"] } } as never,
        }),
      )) as unknown as EventRecord;
    } catch (error) {
      if (isNotFoundOrForbidden(error)) throw notFound("Veranstaltung nicht gefunden.");
      throw error;
    }
  }

  async function pendingRemovalOf(eventId: string): Promise<RemovalRecord | null> {
    const rows = (await client.request(
      readItems("event_removal_requests", {
        filter: { pending_event: { _eq: eventId } },
        fields: [
          "id",
          "event",
          "type",
          "reason",
          "status",
          "decision_comment",
          "date_created",
          "requested_by.first_name",
          "requested_by.last_name",
          "requested_by.email",
        ] as never,
        limit: 1,
      }),
    )) as unknown as RemovalRecord[];
    return rows[0] ?? null;
  }

  /** Loads the event for an action and checks visibility (404 instead of leaking existence). */
  async function loadFor(ctx: AuthContext, id: string) {
    const row = await loadRow(id);
    const removal = await pendingRemovalOf(id);
    const state = stateOf(row, !!removal);
    if (!canViewEvent(ctx, state)) throw notFound("Veranstaltung nicht gefunden.");
    return { row, removal, state };
  }

  async function detailFor(ctx: AuthContext, id: string): Promise<EventDetail> {
    const { row, removal, state } = await loadFor(ctx, id);
    return toDetail(row, removal, {
      allowedActions: allowedActions(ctx, state),
      lockedFields: lockedFields(ctx, state),
    });
  }

  // --- notifications -----------------------------------------------------------------

  async function reviewRecipients(): Promise<string[]> {
    const settings = (await client.request(readSingleton("notification_settings"))) as {
      event_review_recipients?: string[] | null;
    } | null;
    return settings?.event_review_recipients?.filter(Boolean) ?? [];
  }

  async function emailOf(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    try {
      const user = (await client.request(readUser(userId, { fields: ["email"] }))) as {
        email: string | null;
      };
      return user.email;
    } catch {
      return null;
    }
  }

  /** Emails never undo a successful workflow step; failures are logged. */
  async function notify(label: string, send: () => Promise<void>) {
    try {
      await send();
    } catch (error) {
      log.error({ err: error }, `Event notification failed: ${label}`);
    }
  }

  // --- helpers ---------------------------------------------------------------------

  function assertValid(merged: Parameters<typeof eventFieldRules>[0]) {
    const fieldErrors = eventFieldRules(merged);
    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Die Eingaben sind ungültig.", {
        formErrors: [],
        fieldErrors,
      });
    }
  }

  async function assertCategoriesActive(ids: number[] | undefined) {
    if (!ids?.length) return;
    const rows = (await client.request(
      readItems("event_categories", {
        filter: { id: { _in: ids }, active: { _eq: true } },
        fields: ["id"],
        limit: -1,
      }),
    )) as { id: number }[];
    if (rows.length !== new Set(ids).size)
      throw badRequest("INVALID_CATEGORY", "Unbekannte oder deaktivierte Kategorie.");
  }

  async function setStatus(row: EventRecord, to: EventStatus, extra: Record<string, unknown> = {}) {
    await client.request(updateItem("events", row.id, { status: to, ...extra } as never));
  }

  /**
   * Publishes and assigns the public slug on FIRST publication (owner decision:
   * readable, then frozen). Collisions get a numeric suffix via the unique index.
   */
  async function publishRow(row: EventRecord, extra: Record<string, unknown>) {
    if (row.slug) return setStatus(row, "published", extra);
    const base = [row.start_date, slugify(row.title, 80)].filter(Boolean).join("-");
    for (let n = 1; n <= 50; n++) {
      const slug = n === 1 ? base : `${base}-${n}`;
      try {
        return await setStatus(row, "published", { ...extra, slug });
      } catch (error) {
        if (uniqueViolationField(error) !== "slug") throw error;
      }
    }
    throw new AppError(
      500,
      "SLUG_EXHAUSTED",
      "Für diese Veranstaltung konnte keine URL erzeugt werden.",
    );
  }

  const auditEvent = (
    ctx: AuthContext,
    row: EventRecord,
    action: string,
    more: {
      comment?: string | null;
      changes?: { before?: unknown; after?: unknown };
      context?: Record<string, unknown>;
    } = {},
  ) =>
    audit.record({
      actor: ctx.id,
      action,
      entityType: "events",
      entityId: row.id,
      club: row.club?.id ?? null,
      comment: more.comment ?? null,
      changes: more.changes ?? null,
      context: { title: row.title, ...more.context },
    });

  async function upload(file: UploadedFile, title: string): Promise<string> {
    const form = new FormData();
    form.append("title", title);
    form.append(
      "file",
      new Blob([new Uint8Array(file.data)], { type: file.mimetype }),
      file.filename,
    );
    return ((await client.request(uploadFiles(form))) as { id: string }).id;
  }

  async function fetchAsset(fileId: string, download: boolean) {
    const url = new URL(`/assets/${fileId}`, deps.directusUrl);
    if (download) url.searchParams.set("download", "");
    const res = await fetch(url, { headers: { authorization: `Bearer ${deps.serviceToken}` } });
    if (!res.ok) return null;
    return {
      body: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
      contentDisposition: res.headers.get("content-disposition"),
    };
  }

  return {
    async categories(): Promise<EventCategory[]> {
      return (await client.request(
        readItems("event_categories", {
          filter: { active: { _eq: true } },
          fields: ["id", "name", "slug"],
          sort: ["sort", "name"],
          limit: -1,
        }),
      )) as EventCategory[];
    },

    /**
     * Internal lists: federation sees all (optionally the deleted archive);
     * representatives their club's non-deleted events.
     */
    async list(
      ctx: AuthContext,
      filter: { status?: EventStatus; clubId?: string; deleted?: boolean },
    ): Promise<EventSummary[]> {
      const fed = isFederation(ctx);
      if (!fed && ctx.membership?.role !== "representative") throw forbidden();
      const where: Record<string, unknown> = {
        deleted_at: fed && filter.deleted ? { _nnull: true } : { _null: true },
      };
      if (!fed) where.club = { _eq: ctx.membership!.club.id };
      else if (filter.clubId) where.club = { _eq: filter.clubId };
      if (filter.status) where.status = { _eq: filter.status };

      const rows = (await client.request(
        readItems("events", {
          filter: where as never,
          fields: SUMMARY_FIELDS as never,
          sort: ["-start_date"],
          limit: 500,
        }),
      )) as unknown as EventRecord[];
      const pending = rows.length
        ? ((await client.request(
            readItems("event_removal_requests", {
              filter: { pending_event: { _in: rows.map((r) => r.id) } },
              fields: ["pending_event"],
              limit: -1,
            }),
          )) as { pending_event: string }[])
        : [];
      const withRemoval = new Set(pending.map((p) => p.pending_event));
      return rows.map((r) => toSummary(r, withRemoval.has(r.id)));
    },

    /** Federation review dashboard (spec §10.4 indicators). */
    async reviewQueue(ctx: AuthContext): Promise<ReviewQueue> {
      authorize(isFederation(ctx));
      const pendingEvents = (await client.request(
        readItems("events", {
          filter: { status: { _eq: "pending" }, deleted_at: { _null: true } },
          fields: SUMMARY_FIELDS as never,
          sort: ["submitted_at"],
          limit: -1,
        }),
      )) as unknown as EventRecord[];
      const removals = (await client.request(
        readItems("event_removal_requests", {
          filter: { status: { _eq: "pending" } },
          fields: [
            "id",
            "event.id",
            "event.title",
            "type",
            "reason",
            "status",
            "decision_comment",
            "date_created",
            "requested_by.first_name",
            "requested_by.last_name",
            "requested_by.email",
          ] as never,
          sort: ["date_created"],
          limit: -1,
        }),
      )) as unknown as RemovalRecord[];
      return {
        pendingEvents: pendingEvents.map((r) => toSummary(r, false)),
        pendingRemovals: removals.map((r) => ({
          ...toRemoval(r),
          event: r.event as { id: string; title: string },
        })),
      };
    },

    get: detailFor,

    async create(ctx: AuthContext, input: EventCreateInput): Promise<EventDetail> {
      const fed = isFederation(ctx);
      if (!fed && ctx.membership?.role !== "representative") {
        throw forbidden("Veranstaltungen können nur Vereinsvertreter und der Verband anlegen.");
      }
      assertFieldPermissions(ctx, input);
      const clubId = fed ? (input.clubId ?? null) : ctx.membership!.club.id;
      assertValid({ ...input, clubId });
      await assertCategoriesActive(input.categoryIds);

      const created = (await client.request(
        createItem(
          "events",
          {
            ...toRow({ ...input, clubId }),
            status: "draft",
            // Federation-owned events are official by default (spec §7.8).
            official: fed ? (input.official ?? clubId === null) : false,
            created_by: ctx.id,
          } as never,
          { fields: ["id"] },
        ),
      )) as { id: string };
      const row = await loadRow(created.id);
      await auditEvent(ctx, row, "event.created", { changes: { after: comparable(row) } });
      return detailFor(ctx, created.id);
    },

    async update(ctx: AuthContext, id: string, input: EventUpdateInput): Promise<EventDetail> {
      const { row, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "edit");
      assertFieldPermissions(ctx, input);
      const current = comparable(row);
      assertNoLockedChanges(ctx, state, current, input);
      if (input.clubId !== undefined && input.clubId !== null) authorize(isFederation(ctx));
      const merged = {
        ...current,
        ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
      };
      assertValid(merged as Parameters<typeof eventFieldRules>[0]);
      await assertCategoriesActive(input.categoryIds);

      const { categoryIds, schedule, ...scalars } = input;
      const diff = diffFields(
        current as Record<string, unknown>,
        scalars as Record<string, unknown>,
      );
      const changedCollections = [
        ...(categoryIds ? ["categories"] : []),
        ...(schedule ? ["schedule"] : []),
      ];
      if (!diff.changed && changedCollections.length === 0) return detailFor(ctx, id);

      await client.request(updateItem("events", id, toRow(input) as never));
      await auditEvent(ctx, row, "event.updated", {
        changes: {
          before: diff.before,
          after: {
            ...diff.after,
            ...Object.fromEntries(changedCollections.map((c) => [c, "geändert"])),
          },
        },
        context: { status: row.status },
      });
      return detailFor(ctx, id);
    },

    /** Submit / resubmit for review (spec §7.8). */
    async submit(ctx: AuthContext, id: string): Promise<EventDetail> {
      const { row, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "submit");
      const resubmitted = row.status !== "draft";
      await setStatus(row, TRANSITIONS.submit.to, { submitted_by: ctx.id, submitted_at: now() });
      await auditEvent(ctx, row, resubmitted ? "event.resubmitted" : "event.submitted", {
        context: { from: row.status },
      });
      await notify("submitted", async () => {
        const to = await reviewRecipients();
        if (!to.length)
          return log.warn("No event_review_recipients configured in notification_settings");
        await mailer.send(
          eventSubmittedEmail({
            to,
            title: row.title,
            clubName: row.club?.name ?? null,
            eventId: id,
            webPublicUrl: deps.webPublicUrl,
            resubmitted,
          }),
        );
      });
      return detailFor(ctx, id);
    },

    async approve(
      ctx: AuthContext,
      id: string,
      version: string,
      comment?: string,
    ): Promise<EventDetail> {
      const { row, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "approve");
      assertVersion(versionOf(row), version);
      const at = now();
      await publishRow(row, {
        reviewed_by: ctx.id,
        reviewed_at: at,
        review_comment: null,
        published_at: row.published_at ?? at,
      });
      await auditEvent(ctx, row, "event.approved", { comment: comment ?? null });
      await notify("approved", async () => {
        const to = await emailOf(row.submitted_by);
        if (to)
          await mailer.send(
            eventDecisionEmail({
              to,
              title: row.title,
              approved: true,
              comment: comment ?? null,
              eventId: id,
              webPublicUrl: deps.webPublicUrl,
            }),
          );
      });
      return detailFor(ctx, id);
    },

    async reject(
      ctx: AuthContext,
      id: string,
      version: string,
      comment: string,
    ): Promise<EventDetail> {
      const { row, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "reject");
      assertVersion(versionOf(row), version);
      await setStatus(row, TRANSITIONS.reject.to, {
        reviewed_by: ctx.id,
        reviewed_at: now(),
        review_comment: comment,
      });
      await auditEvent(ctx, row, "event.rejected", { comment });
      await notify("rejected", async () => {
        const to = await emailOf(row.submitted_by);
        if (to)
          await mailer.send(
            eventDecisionEmail({
              to,
              title: row.title,
              approved: false,
              comment,
              eventId: id,
              webPublicUrl: deps.webPublicUrl,
            }),
          );
      });
      return detailFor(ctx, id);
    },

    /** Federation publishes directly (official events / on behalf of clubs, spec §7.8). */
    async publish(ctx: AuthContext, id: string, comment?: string): Promise<EventDetail> {
      const { row, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "publish");
      const at = now();
      await publishRow(row, {
        reviewed_by: ctx.id,
        reviewed_at: at,
        review_comment: null,
        published_at: row.published_at ?? at,
      });
      await auditEvent(ctx, row, "event.published", {
        comment: comment ?? null,
        context: { from: row.status },
      });
      return detailFor(ctx, id);
    },

    async unpublish(ctx: AuthContext, id: string, comment?: string): Promise<EventDetail> {
      const { row, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "unpublish");
      await setStatus(row, TRANSITIONS.unpublish.to);
      await auditEvent(ctx, row, "event.unpublished", { comment: comment ?? null });
      return detailFor(ctx, id);
    },

    /** Representative asks to unpublish/delete a published event; it stays public until decided. */
    async requestRemoval(
      ctx: AuthContext,
      id: string,
      type: "unpublish" | "delete",
      reason: string,
    ): Promise<EventDetail> {
      const { row, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "requestRemoval");
      try {
        await client.request(
          createItem("event_removal_requests", {
            event: id,
            type,
            reason,
            status: "pending",
            pending_event: id,
            requested_by: ctx.id,
          } as never),
        );
      } catch (error) {
        if (uniqueViolationField(error) === "pending_event") {
          throw conflict(
            "REMOVAL_PENDING",
            "Für diese Veranstaltung gibt es bereits einen offenen Antrag.",
          );
        }
        throw error;
      }
      await auditEvent(ctx, row, "event.removal_requested", { comment: reason, context: { type } });
      await notify("removal requested", async () => {
        const to = await reviewRecipients();
        if (to.length)
          await mailer.send(
            removalRequestedEmail({
              to,
              title: row.title,
              type,
              reason,
              eventId: id,
              webPublicUrl: deps.webPublicUrl,
            }),
          );
      });
      return detailFor(ctx, id);
    },

    /**
     * Federation decides a removal request. Event change and request decision are
     * written in ONE nested Directus request (single transaction).
     */
    async decideRemoval(
      ctx: AuthContext,
      id: string,
      approve: boolean,
      comment?: string,
    ): Promise<EventDetail> {
      const { row, removal, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "decideRemoval");
      const at = now();
      const decision = {
        id: removal!.id,
        status: approve ? "approved" : "rejected",
        pending_event: null,
        decided_by: ctx.id,
        decided_at: at,
        decision_comment: comment ?? null,
      };
      const eventChange: Record<string, unknown> = {};
      if (approve) {
        if (row.status === "published") eventChange.status = "unpublished";
        if (removal!.type === "delete")
          Object.assign(eventChange, { deleted_at: at, deleted_by: ctx.id });
      }
      await client.request(
        updateItem("events", id, {
          ...eventChange,
          removal_requests: { create: [], update: [decision], delete: [] },
        } as never),
      );
      await auditEvent(ctx, row, approve ? "event.removal_approved" : "event.removal_rejected", {
        comment: comment ?? null,
        context: { type: removal!.type, request: removal!.id },
      });
      await notify("removal decided", async () => {
        const requester = (await client.request(
          readItem("event_removal_requests", removal!.id, { fields: ["requested_by"] }),
        )) as { requested_by: string };
        const to = await emailOf(requester.requested_by);
        if (to)
          await mailer.send(
            removalDecidedEmail({
              to,
              title: row.title,
              type: removal!.type,
              approved: approve,
              comment: comment ?? null,
              eventId: id,
              webPublicUrl: deps.webPublicUrl,
            }),
          );
      });
      return detailFor(ctx, id);
    },

    /** Soft delete: by the club for never-published drafts/rejected (`discard`), by the federation for any event. */
    async remove(ctx: AuthContext, id: string, comment?: string): Promise<void> {
      const { row, removal, state } = await loadFor(ctx, id);
      const action = isFederation(ctx) ? "delete" : "discard";
      assertAction(ctx, state, action);
      const at = now();
      const payload: Record<string, unknown> = { deleted_at: at, deleted_by: ctx.id };
      if (removal) {
        payload.removal_requests = {
          create: [],
          update: [
            {
              id: removal.id,
              status: "approved",
              pending_event: null,
              decided_by: ctx.id,
              decided_at: at,
              decision_comment: "Durch den Verband gelöscht.",
            },
          ],
          delete: [],
        };
      }
      await client.request(updateItem("events", id, payload as never));
      await auditEvent(ctx, row, action === "delete" ? "event.deleted" : "event.discarded", {
        comment: comment ?? null,
        context: { status: row.status },
      });
    },

    async history(ctx: AuthContext, id: string): Promise<EventHistoryEntry[]> {
      const { state } = await loadFor(ctx, id);
      authorize(isFederation(ctx) || (!!state.clubId && isRepresentativeOf(ctx, state.clubId)));
      const rows = (await client.request(
        readItems("audit_logs", {
          filter: { entity_type: { _eq: "events" }, entity_id: { _eq: id } },
          fields: [
            "id",
            "action",
            "timestamp",
            "comment",
            "changes",
            "actor.first_name",
            "actor.last_name",
          ] as never,
          sort: ["-timestamp", "-id"],
          limit: 200,
        }),
      )) as unknown as {
        id: number | string;
        action: string;
        timestamp: string | null;
        comment: string | null;
        changes: { after?: Record<string, unknown> } | null;
        actor: { first_name: string | null; last_name: string | null } | null;
      }[];
      return rows.map((r) => ({
        id: Number(r.id), // bigInteger ids arrive as strings from Directus
        action: r.action,
        at: r.timestamp,
        actorName: r.actor
          ? [r.actor.first_name, r.actor.last_name].filter(Boolean).join(" ") || null
          : null,
        comment: r.comment,
        changedFields: r.action === "event.updated" ? Object.keys(r.changes?.after ?? {}) : [],
      }));
    },

    // --- files & images ---------------------------------------------------------

    async addFile(
      ctx: AuthContext,
      id: string,
      file: UploadedFile,
      meta: EventFileMeta,
    ): Promise<EventDetail> {
      const { row, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "edit");
      if (!EVENT_FILE_MIME_TYPES.includes(file.mimetype)) {
        throw badRequest(
          "INVALID_FILE_TYPE",
          "Dieser Dateityp ist nicht erlaubt (PDF, Office, Text, ZIP oder Bild).",
        );
      }
      const label = eventFileLabel(meta.type, meta.description);
      const fileId = await upload(file, `${row.title} – ${label}`);
      const sort = (row.files?.length ?? 0) + 1;
      await client.request(
        createItem("event_files", {
          event: id,
          file: fileId,
          type: meta.type,
          description: meta.description ?? null,
          sort,
        } as never),
      );
      await auditEvent(ctx, row, "event.file_added", {
        context: { description: label, file: fileId },
      });
      return detailFor(ctx, id);
    },

    async updateFile(
      ctx: AuthContext,
      id: string,
      eventFileId: string,
      meta: EventFileMeta,
    ): Promise<EventDetail> {
      const { row, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "edit");
      if (!row.files?.some((f) => f.id === eventFileId)) throw notFound("Datei nicht gefunden.");
      await client.request(
        updateItem("event_files", eventFileId, {
          type: meta.type,
          description: meta.description ?? null,
        } as never),
      );
      return detailFor(ctx, id);
    },

    async removeFile(ctx: AuthContext, id: string, eventFileId: string): Promise<EventDetail> {
      const { row, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "edit");
      const file = row.files?.find((f) => f.id === eventFileId);
      if (!file) throw notFound("Datei nicht gefunden.");
      await client.request(deleteItem("event_files", eventFileId));
      await auditEvent(ctx, row, "event.file_removed", {
        context: { description: eventFileLabel(file.type ?? "other", file.description) },
      });
      return detailFor(ctx, id);
    },

    async setImage(
      ctx: AuthContext,
      id: string,
      kind: EventImageKind,
      file: UploadedFile | null,
    ): Promise<EventDetail> {
      const { row, state } = await loadFor(ctx, id);
      assertAction(ctx, state, "edit");
      let fileId: string | null = null;
      if (file) {
        if (!EVENT_IMAGE_MIME_TYPES.includes(file.mimetype)) {
          throw badRequest(
            "INVALID_FILE_TYPE",
            "Bitte ein Bild als PNG, JPEG oder WebP hochladen.",
          );
        }
        if (file.data.length > EVENT_IMAGE_MAX_BYTES)
          throw new AppError(413, "FILE_TOO_LARGE", "Das Bild darf höchstens 5 MB groß sein.");
        fileId = await upload(file, `${row.title} – ${kind === "logo" ? "Logo" : "Titelbild"}`);
      }
      await client.request(updateItem("events", id, { [kind]: fileId } as never));
      await auditEvent(ctx, row, "event.image_changed", {
        changes: { before: { [kind]: row[kind] }, after: { [kind]: fileId } },
      });
      return detailFor(ctx, id);
    },

    /**
     * File/image delivery. Published events: public. Otherwise only users who may
     * view the event internally. Deleted events: federation only.
     */
    async fetchFile(
      ctx: AuthContext | null,
      id: string,
      target: { eventFileId: string } | { image: EventImageKind },
    ) {
      const row = await loadRow(id, [...DETAIL_FIELDS]).catch(() => null);
      if (!row) return null;
      const removal = ctx ? await pendingRemovalOf(id) : null;
      if (!canViewEvent(ctx, stateOf(row, !!removal))) return null;
      const fileId =
        "image" in target
          ? row[target.image]
          : row.files?.find((f) => f.id === target.eventFileId)?.file?.id;
      if (!fileId) return null;
      return fetchAsset(fileId, !("image" in target));
    },
  };
}

export type EventService = ReturnType<typeof createEventService>;
