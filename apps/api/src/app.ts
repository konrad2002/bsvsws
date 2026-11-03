import Fastify, { type FastifyServerOptions } from "fastify";
import type { Env } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";

/**
 * Builds the Fastify application without starting it (used by server and tests).
 * Routes stay thin: business logic belongs in src/modules/<domain>/ services.
 * All persistence goes through Directus – never connect to PostgreSQL directly.
 */
export async function buildApp(env: Env, options: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    ...options,
  });

  await app.register(healthRoutes, { directusUrl: env.DIRECTUS_URL });

  return app;
}
