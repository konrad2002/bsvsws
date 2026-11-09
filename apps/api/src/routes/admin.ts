import {
  accountListQuerySchema,
  appSettingsUpdateSchema,
  auditLogQuerySchema,
} from "@bsv-sws/validation";
import type { FastifyPluginAsync } from "fastify";
import { parseInput } from "../lib/errors.js";
import type { AdminService } from "../modules/admin/admin-service.js";
import type { AuthService } from "../modules/auth/auth-service.js";

/** Federation administration (Phase 7). Authorization happens in AdminService. */
export const adminRoutes: FastifyPluginAsync<{ auth: AuthService; admin: AdminService }> = async (
  app,
  { auth, admin },
) => {
  const ctxOf = (headers: { authorization?: string }) => auth.authenticate(headers.authorization);

  app.get("/admin/settings", async (req) => admin.getSettings(await ctxOf(req.headers)));

  app.put("/admin/settings", async (req) => {
    const ctx = await ctxOf(req.headers);
    return admin.updateSettings(ctx, parseInput(appSettingsUpdateSchema, req.body));
  });

  app.get("/admin/accounts", async (req) => {
    const ctx = await ctxOf(req.headers);
    return admin.listAccounts(ctx, parseInput(accountListQuerySchema, req.query));
  });

  app.get("/admin/audit-log", async (req) => {
    const ctx = await ctxOf(req.headers);
    return admin.listAuditLog(ctx, parseInput(auditLogQuerySchema, req.query));
  });
};
