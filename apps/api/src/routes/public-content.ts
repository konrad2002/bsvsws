import { articleQuerySchema, uuidSchema } from "@bsv-sws/validation";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { notFound, parseInput } from "../lib/errors.js";
import type { PublicContentService } from "../modules/content/public-content-service.js";

const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) });
const pathQuery = z.object({
  path: z
    .string()
    .max(500)
    .regex(/^\/[^\s]*$/),
});
const redirectQuery = z.object({
  path: z.string().max(1000).startsWith("/"),
  query: z.string().max(1000).default(""),
});
const mediaQuery = z.object({ width: z.coerce.number().int().min(16).max(2400).optional() });

/**
 * Public CMS endpoints (Phase 5). Anonymous → user level "visitor"; protected
 * content follows in Phase 6.
 */
export const publicContentRoutes: FastifyPluginAsync<{ content: PublicContentService }> = async (
  app,
  { content },
) => {
  const limit = (max: number) => ({ config: { rateLimit: { max, timeWindow: "1 minute" } } });

  app.get("/public/navigation", limit(240), async () => content.navigation("visitor"));

  app.get("/public/pages", limit(120), async (req) =>
    content.page(parseInput(pathQuery, req.query).path, "visitor"),
  );

  app.get("/public/articles", limit(120), async (req) =>
    content.articles(parseInput(articleQuerySchema, req.query)),
  );

  app.get("/public/articles/:slug", limit(120), async (req) =>
    content.article(parseInput(slugParams, req.params).slug),
  );

  app.get("/public/article-categories", limit(120), async () => content.articleCategories());

  app.get("/public/clubs", limit(120), async () => content.clubs());

  app.get("/public/clubs/:slug", limit(120), async (req) =>
    content.club(parseInput(slugParams, req.params).slug),
  );

  app.get("/public/redirects", limit(240), async (req) => {
    const { path, query } = parseInput(redirectQuery, req.query);
    const hit = await content.resolveRedirect(path, query);
    if (!hit) throw notFound("Keine Weiterleitung.");
    return hit;
  });

  /** Used by the Next.js proxy for real HTTP status codes (see content service). */
  app.get("/public/resolve", limit(1200), async (req) => {
    const { path, query } = parseInput(redirectQuery, req.query);
    return content.resolve(path, query);
  });

  app.get("/public/media/:fileId", limit(600), async (req, reply) => {
    const { fileId } = parseInput(z.object({ fileId: uuidSchema }), req.params);
    const { width } = parseInput(mediaQuery, req.query);
    const file = await content.media(fileId, width);
    if (!file) throw notFound("Datei nicht gefunden.");
    reply
      .type(file.contentType)
      .header("cache-control", "public, max-age=3600")
      .header("x-content-type-options", "nosniff");
    if (file.contentDisposition) reply.header("content-disposition", file.contentDisposition);
    return reply.send(file.body);
  });
};
