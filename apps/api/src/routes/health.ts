import type { FastifyPluginAsync } from "fastify";

interface HealthRouteOptions {
  directusUrl: string;
}

/**
 * Liveness (`/health`) and readiness (`/health/ready`, includes Directus) probes.
 */
export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (
  app,
  { directusUrl },
) => {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_request, reply) => {
    try {
      const res = await fetch(new URL("/server/ping", directusUrl), {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`Directus responded with ${res.status}`);
      return { status: "ok", directus: "ok" };
    } catch (error) {
      app.log.warn({ err: error }, "Directus readiness check failed");
      return reply.code(503).send({ status: "unavailable", directus: "unreachable" });
    }
  });
};
