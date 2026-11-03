import {
  invitationRegisterSchema,
  invitationTokenSchema,
  uuidSchema,
  verificationCodeSchema,
} from "@bsv-sws/validation";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseInput } from "../lib/errors.js";
import type { AuthService } from "../modules/auth/auth-service.js";
import type { InvitationService } from "../modules/invitations/invitation-service.js";

const idParams = z.object({ invitationId: uuidSchema });
const tokenParams = z.object({ token: invitationTokenSchema });
const resendBody = z.object({ sendEmail: z.boolean().default(true) });

/** Per client IP + token, so one link cannot be hammered from one address. */
const perToken = (req: FastifyRequest) =>
  `${(req.headers["x-client-ip"] as string | undefined) ?? req.ip}:${(req.params as { token?: string }).token ?? ""}`;
const limit = (max: number, timeWindow: string, keyGenerator = perToken) => ({
  config: { rateLimit: { max, timeWindow, keyGenerator } },
});

export const invitationRoutes: FastifyPluginAsync<{
  auth: AuthService;
  invitations: InvitationService;
}> = async (app, { auth, invitations }) => {
  // --- management (authenticated) ---------------------------------------------
  app.post("/invitations/:invitationId/resend", limit(20, "1 hour"), async (req) => {
    const ctx = await auth.authenticate(req.headers.authorization);
    const { invitationId } = parseInput(idParams, req.params);
    const { sendEmail } = parseInput(resendBody, req.body ?? {});
    return invitations.regenerate(ctx, invitationId, sendEmail);
  });

  app.post("/invitations/:invitationId/revoke", async (req) => {
    const ctx = await auth.authenticate(req.headers.authorization);
    const { invitationId } = parseInput(idParams, req.params);
    return invitations.revoke(ctx, invitationId);
  });

  // --- link holder (public) -----------------------------------------------------
  app.get("/invitations/by-token/:token", limit(60, "15 minutes"), async (req) => {
    const { token } = parseInput(tokenParams, req.params);
    return invitations.getPublic(token);
  });

  app.post("/invitations/by-token/:token/register", limit(5, "15 minutes"), async (req, reply) => {
    const { token } = parseInput(tokenParams, req.params);
    await invitations.register(token, parseInput(invitationRegisterSchema, req.body));
    return reply.code(202).send({ status: "verification_required" });
  });

  app.post(
    "/invitations/by-token/:token/resend-code",
    limit(3, "15 minutes"),
    async (req, reply) => {
      const { token } = parseInput(tokenParams, req.params);
      await invitations.resendCode(token);
      return reply.code(202).send({ status: "verification_required" });
    },
  );

  app.post("/invitations/by-token/:token/verify", limit(10, "15 minutes"), async (req) => {
    const { token } = parseInput(tokenParams, req.params);
    const { code } = parseInput(verificationCodeSchema, req.body);
    return invitations.verify(token, code);
  });

  app.post("/invitations/by-token/:token/accept", limit(10, "15 minutes"), async (req, reply) => {
    const ctx = await auth.authenticate(req.headers.authorization);
    const { token } = parseInput(tokenParams, req.params);
    await invitations.acceptExisting(ctx, token);
    return reply.code(204).send();
  });
};
