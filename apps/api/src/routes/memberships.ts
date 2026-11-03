import { membershipRoleChangeSchema, uuidSchema } from "@bsv-sws/validation";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseInput } from "../lib/errors.js";
import type { AuthService } from "../modules/auth/auth-service.js";
import type { MembershipService } from "../modules/memberships/membership-service.js";

const params = z.object({ membershipId: uuidSchema });

export const membershipRoutes: FastifyPluginAsync<{
  auth: AuthService;
  memberships: MembershipService;
}> = async (app, { auth, memberships }) => {
  /** Promote / demote. */
  app.patch("/memberships/:membershipId", async (req) => {
    const ctx = await auth.authenticate(req.headers.authorization);
    const { membershipId } = parseInput(params, req.params);
    const { role } = parseInput(membershipRoleChangeSchema, req.body);
    return memberships.changeRole(ctx, membershipId, role);
  });

  /** Remove from club (membership ends, account stays). */
  app.delete("/memberships/:membershipId", async (req, reply) => {
    const ctx = await auth.authenticate(req.headers.authorization);
    const { membershipId } = parseInput(params, req.params);
    await memberships.remove(ctx, membershipId);
    return reply.code(204).send();
  });
};
