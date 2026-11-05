import { EVENT_STATUSES } from "@bsv-sws/shared";
import {
  eventCommentSchema,
  eventCreateSchema,
  eventFileMetaSchema,
  eventRejectSchema,
  eventReviewSchema,
  eventUpdateSchema,
  removalDecisionSchema,
  removalRequestSchema,
  uuidSchema,
} from "@bsv-sws/validation";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { badRequest, notFound, parseInput } from "../lib/errors.js";
import type { AuthContext, AuthService } from "../modules/auth/auth-service.js";
import {
  EVENT_FILE_MAX_BYTES,
  EVENT_IMAGE_MAX_BYTES,
  type EventImageKind,
  type EventService,
} from "../modules/events/event-service.js";

const idParams = z.object({ eventId: uuidSchema });
const fileParams = idParams.extend({ fileId: uuidSchema });
const imageParams = idParams.extend({ kind: z.enum(["title_image", "logo"]) });
const listQuery = z.object({
  status: z.enum(EVENT_STATUSES).optional(),
  clubId: uuidSchema.optional(),
  deleted: z.enum(["true", "false"]).optional(),
});

export const eventRoutes: FastifyPluginAsync<{ auth: AuthService; events: EventService }> = async (
  app,
  { auth, events },
) => {
  const ctxOf = (req: FastifyRequest) => auth.authenticate(req.headers.authorization);
  /** For downloads: a missing or invalid token means "anonymous" (published events only). */
  const optionalCtx = async (req: FastifyRequest): Promise<AuthContext | null> => {
    if (!req.headers.authorization) return null;
    try {
      return await ctxOf(req);
    } catch {
      return null;
    }
  };
  const id = (req: FastifyRequest) => parseInput(idParams, req.params).eventId;

  async function readUpload(req: FastifyRequest, maxBytes: number) {
    const file = await req.file({ limits: { fileSize: maxBytes } });
    if (!file) throw badRequest("FILE_REQUIRED", "Bitte eine Datei auswählen.");
    const data = await file.toBuffer(); // throws 413 above the limit
    // Multipart text fields must precede the file part in the request body.
    const field = (name: string) => {
      const value = (file.fields[name] as { value?: unknown } | undefined)?.value;
      return typeof value === "string" ? value : undefined;
    };
    return {
      file: { filename: file.filename, mimetype: file.mimetype, data },
      field,
    };
  }

  function sendAsset(reply: FastifyReply, asset: Awaited<ReturnType<EventService["fetchFile"]>>) {
    if (!asset) throw notFound("Datei nicht gefunden.");
    reply
      .type(asset.contentType)
      .header("x-content-type-options", "nosniff")
      .header("cache-control", "private, max-age=60");
    if (asset.contentDisposition) reply.header("content-disposition", asset.contentDisposition);
    return reply.send(asset.body);
  }

  app.get("/event-categories", async (req) => {
    await ctxOf(req);
    return events.categories();
  });

  app.get("/events", async (req) => {
    const q = parseInput(listQuery, req.query);
    return events.list(await ctxOf(req), {
      status: q.status,
      clubId: q.clubId,
      deleted: q.deleted === "true",
    });
  });

  app.get("/events/review", async (req) => events.reviewQueue(await ctxOf(req)));

  app.post("/events", async (req, reply) => {
    const ctx = await ctxOf(req);
    return reply.code(201).send(await events.create(ctx, parseInput(eventCreateSchema, req.body)));
  });

  app.get("/events/:eventId", async (req) => events.get(await ctxOf(req), id(req)));

  app.patch("/events/:eventId", async (req) =>
    events.update(await ctxOf(req), id(req), parseInput(eventUpdateSchema, req.body)),
  );

  app.delete("/events/:eventId", async (req, reply) => {
    const { comment } = parseInput(eventCommentSchema, req.body ?? {});
    await events.remove(await ctxOf(req), id(req), comment);
    return reply.code(204).send();
  });

  app.get("/events/:eventId/history", async (req) => events.history(await ctxOf(req), id(req)));

  // --- workflow -----------------------------------------------------------------
  app.post("/events/:eventId/submit", async (req) => events.submit(await ctxOf(req), id(req)));

  app.post("/events/:eventId/approve", async (req) => {
    const { version, comment } = parseInput(eventReviewSchema, req.body);
    return events.approve(await ctxOf(req), id(req), version, comment);
  });

  app.post("/events/:eventId/reject", async (req) => {
    const { version, comment } = parseInput(eventRejectSchema, req.body);
    return events.reject(await ctxOf(req), id(req), version, comment);
  });

  app.post("/events/:eventId/publish", async (req) => {
    const { comment } = parseInput(eventCommentSchema, req.body ?? {});
    return events.publish(await ctxOf(req), id(req), comment);
  });

  app.post("/events/:eventId/unpublish", async (req) => {
    const { comment } = parseInput(eventCommentSchema, req.body ?? {});
    return events.unpublish(await ctxOf(req), id(req), comment);
  });

  app.post("/events/:eventId/removal-request", async (req) => {
    const { type, reason } = parseInput(removalRequestSchema, req.body);
    return events.requestRemoval(await ctxOf(req), id(req), type, reason);
  });

  app.post("/events/:eventId/removal-decision", async (req) => {
    const { approve, comment } = parseInput(removalDecisionSchema, req.body);
    return events.decideRemoval(await ctxOf(req), id(req), approve, comment);
  });

  // --- files & images -------------------------------------------------------------
  app.post("/events/:eventId/files", async (req, reply) => {
    const ctx = await ctxOf(req);
    const { file, field } = await readUpload(req, EVENT_FILE_MAX_BYTES);
    const meta = parseInput(eventFileMetaSchema, {
      type: field("type") || undefined,
      description: field("description"),
    });
    return reply.code(201).send(await events.addFile(ctx, id(req), file, meta));
  });

  app.patch("/events/:eventId/files/:fileId", async (req) => {
    const { eventId, fileId } = parseInput(fileParams, req.params);
    const meta = parseInput(eventFileMetaSchema, req.body);
    return events.updateFile(await ctxOf(req), eventId, fileId, meta);
  });

  app.delete("/events/:eventId/files/:fileId", async (req) => {
    const { eventId, fileId } = parseInput(fileParams, req.params);
    return events.removeFile(await ctxOf(req), eventId, fileId);
  });

  app.get("/events/:eventId/files/:fileId", async (req, reply) => {
    const { eventId, fileId } = parseInput(fileParams, req.params);
    return sendAsset(
      reply,
      await events.fetchFile(await optionalCtx(req), eventId, { eventFileId: fileId }),
    );
  });

  app.put("/events/:eventId/images/:kind", async (req) => {
    const ctx = await ctxOf(req);
    const { eventId, kind } = parseInput(imageParams, req.params);
    const { file } = await readUpload(req, EVENT_IMAGE_MAX_BYTES);
    return events.setImage(ctx, eventId, kind as EventImageKind, file);
  });

  app.delete("/events/:eventId/images/:kind", async (req) => {
    const { eventId, kind } = parseInput(imageParams, req.params);
    return events.setImage(await ctxOf(req), eventId, kind as EventImageKind, null);
  });

  app.get("/events/:eventId/images/:kind", async (req, reply) => {
    const { eventId, kind } = parseInput(imageParams, req.params);
    return sendAsset(
      reply,
      await events.fetchFile(await optionalCtx(req), eventId, { image: kind as EventImageKind }),
    );
  });
};
