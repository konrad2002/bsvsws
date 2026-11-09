import {
  clubCreateSchema,
  clubUpdateSchema,
  invitationCreateSchema,
  uuidSchema,
} from "@bsv-sws/validation";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { badRequest, notFound, parseInput } from "../lib/errors.js";
import type { AuthService } from "../modules/auth/auth-service.js";
import { LOGO_MAX_BYTES, type ClubService } from "../modules/clubs/club-service.js";
import type { InvitationService } from "../modules/invitations/invitation-service.js";
import type { MembershipService } from "../modules/memberships/membership-service.js";

const clubParams = z.object({ clubId: uuidSchema });

export const clubRoutes: FastifyPluginAsync<{
  auth: AuthService;
  clubs: ClubService;
  memberships: MembershipService;
  invitations: InvitationService;
}> = async (app, { auth, clubs, memberships, invitations }) => {
  const ctxOf = (headers: { authorization?: string }) => auth.authenticate(headers.authorization);

  app.get("/clubs", async (req) => clubs.list(await ctxOf(req.headers)));

  app.post("/clubs", async (req, reply) => {
    const ctx = await ctxOf(req.headers);
    const club = await clubs.create(ctx, parseInput(clubCreateSchema, req.body));
    return reply.code(201).send(club);
  });

  app.get("/clubs/:clubId", async (req) => {
    const { clubId } = parseInput(clubParams, req.params);
    return clubs.get(await ctxOf(req.headers), clubId);
  });

  app.patch("/clubs/:clubId", async (req) => {
    const { clubId } = parseInput(clubParams, req.params);
    return clubs.update(await ctxOf(req.headers), clubId, parseInput(clubUpdateSchema, req.body));
  });

  app.put("/clubs/:clubId/logo", async (req) => {
    const ctx = await ctxOf(req.headers);
    const { clubId } = parseInput(clubParams, req.params);
    const file = await req.file({ limits: { fileSize: LOGO_MAX_BYTES } });
    if (!file) throw badRequest("FILE_REQUIRED", "Bitte eine Datei auswählen.");
    const data = await file.toBuffer(); // throws 413 above the configured limit
    return clubs.setLogo(ctx, clubId, { filename: file.filename, mimetype: file.mimetype, data });
  });

  app.delete("/clubs/:clubId/logo", async (req) => {
    const { clubId } = parseInput(clubParams, req.params);
    return clubs.removeLogo(await ctxOf(req.headers), clubId);
  });

  /** Public: club logo (no authentication). */
  app.get("/clubs/:clubId/logo", async (req, reply) => {
    const { clubId } = parseInput(clubParams, req.params);
    const logo = await clubs.fetchLogo(clubId);
    if (!logo) throw notFound("Kein Logo vorhanden.");
    return reply
      .type(logo.contentType)
      .header("cache-control", "public, max-age=300")
      .header("x-content-type-options", "nosniff")
      .send(logo.body);
  });

  app.get("/clubs/:clubId/members", async (req) => {
    const { clubId } = parseInput(clubParams, req.params);
    return memberships.listMembers(await ctxOf(req.headers), clubId);
  });

  app.get("/clubs/:clubId/invitations", async (req) => {
    const { clubId } = parseInput(clubParams, req.params);
    return invitations.listForClub(await ctxOf(req.headers), clubId);
  });

  app.post(
    "/clubs/:clubId/invitations",
    { config: { rateLimit: { max: 30, timeWindow: "1 hour" } } },
    async (req, reply) => {
      const ctx = await ctxOf(req.headers);
      const { clubId } = parseInput(clubParams, req.params);
      const result = await invitations.create(
        ctx,
        clubId,
        parseInput(invitationCreateSchema, req.body),
      );
      return reply.code(201).send(result);
    },
  );
};
