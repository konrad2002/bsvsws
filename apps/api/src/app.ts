import Fastify, { type FastifyServerOptions } from "fastify";
import type { Env } from "./config/env.js";
import { registerErrorHandler } from "./lib/errors.js";
import { createAuthService } from "./modules/auth/auth-service.js";
import {
  createDirectusIdentityProvider,
  type IdentityProvider,
} from "./modules/auth/identity-provider.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";

export interface AppDeps {
  /** Override for tests; defaults to the real Directus-backed provider. */
  identity?: IdentityProvider;
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

  const identity =
    deps.identity ?? createDirectusIdentityProvider(env.DIRECTUS_URL, env.DIRECTUS_SERVICE_TOKEN);
  const auth = createAuthService(identity);

  await app.register(healthRoutes, { directusUrl: env.DIRECTUS_URL });
  await app.register(meRoutes, { auth });

  return app;
}
