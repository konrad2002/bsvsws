import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { Env } from "./config/env.js";
import { createServiceClient } from "./lib/directus.js";
import { registerErrorHandler } from "./lib/errors.js";
import { createSmtpMailer, type Mailer } from "./lib/mailer.js";
import { createAuditService } from "./modules/audit/audit-service.js";
import { createAuthService } from "./modules/auth/auth-service.js";
import {
  createDirectusIdentityProvider,
  type IdentityProvider,
} from "./modules/auth/identity-provider.js";
import { createClubService } from "./modules/clubs/club-service.js";
import { createEventService, EVENT_FILE_MAX_BYTES } from "./modules/events/event-service.js";
import { createInvitationService } from "./modules/invitations/invitation-service.js";
import { createMembershipService } from "./modules/memberships/membership-service.js";
import { createPublicEventService } from "./modules/public-calendar/public-event-service.js";
import { clubRoutes } from "./routes/clubs.js";
import { eventRoutes } from "./routes/events.js";
import { healthRoutes } from "./routes/health.js";
import { invitationRoutes } from "./routes/invitations.js";
import { meRoutes } from "./routes/me.js";
import { membershipRoutes } from "./routes/memberships.js";
import { publicRoutes } from "./routes/public.js";

export interface AppDeps {
  /** Overrides for tests; default to the real Directus/SMTP implementations. */
  identity?: IdentityProvider;
  mailer?: Mailer;
  now?: () => Date;
}

/**
 * Builds the Fastify application without starting it (used by server and tests).
 * Routes stay thin: business logic belongs in src/modules/<domain>/ services.
 * All persistence goes through Directus – never connect to PostgreSQL directly.
 */
export async function buildApp(env: Env, options: FastifyServerOptions = {}, deps: AppDeps = {}) {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    ...options,
  });

  registerErrorHandler(app);

  // Fastify is only reachable from the Next.js server, which forwards the browser's
  // IP as x-client-ip. Limits are per route (spec §11.3); in memory (single instance).
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (req) => (req.headers["x-client-ip"] as string | undefined) ?? req.ip,
  });
  // Global upper bound; routes set tighter per-file limits (logos 2 MB, images 5 MB).
  await app.register(multipart, {
    limits: { fileSize: EVENT_FILE_MAX_BYTES, files: 1, fields: 5 },
  });

  const client = createServiceClient(env.DIRECTUS_URL, env.DIRECTUS_SERVICE_TOKEN);
  const identity =
    deps.identity ?? createDirectusIdentityProvider(env.DIRECTUS_URL, env.DIRECTUS_SERVICE_TOKEN);
  const mailer = deps.mailer ?? createSmtpMailer(env);
  const now = deps.now;

  const auth = createAuthService(identity);
  const audit = createAuditService(client, app.log);
  const clubs = createClubService({
    client,
    audit,
    directusUrl: env.DIRECTUS_URL,
    serviceToken: env.DIRECTUS_SERVICE_TOKEN,
  });
  const memberships = createMembershipService({ client, audit, now });
  const invitations = createInvitationService({
    client,
    audit,
    mailer,
    log: app.log,
    appSecret: env.APP_SECRET,
    webPublicUrl: env.WEB_PUBLIC_URL,
    invitationTtlDays: env.INVITATION_TTL_DAYS,
    now,
  });

  const events = createEventService({
    client,
    audit,
    mailer,
    log: app.log,
    webPublicUrl: env.WEB_PUBLIC_URL,
    directusUrl: env.DIRECTUS_URL,
    serviceToken: env.DIRECTUS_SERVICE_TOKEN,
    now,
  });

  const publicEvents = createPublicEventService({ client, webPublicUrl: env.WEB_PUBLIC_URL, now });

  await app.register(healthRoutes, { directusUrl: env.DIRECTUS_URL });
  await app.register(meRoutes, { auth });
  await app.register(clubRoutes, { auth, clubs, memberships, invitations });
  await app.register(membershipRoutes, { auth, memberships });
  await app.register(invitationRoutes, { auth, invitations });
  await app.register(eventRoutes, { auth, events });
  await app.register(publicRoutes, { events: publicEvents });

  return app;
}
