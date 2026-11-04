import { articleQuerySchema, uuidSchema } from "@bsv-sws/validation";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { forbidden, notFound, parseInput, unauthorized } from "../lib/errors.js";
import type { AuthContext, AuthService } from "../modules/auth/auth-service.js";
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
export const publicContentRoutes: FastifyPluginAsync<{
  content: PublicContentService;
  auth: AuthService;
}> = async (app, { content, auth }) => {
  /** Missing/invalid token → anonymous (files are public or not). */
  const optionalCtx = async (authorization: string | undefined): Promise<AuthContext | null> => {
    if (!authorization) return null;
    try {
      return await auth.authenticate(authorization);
    } catch {
      return null;
    }
  };
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

  /**
   * CMS files (/medien/<id>) with the visibility of the referencing content
   * (spec §8.5). Optional login: 401 if login could help, 403 if not allowed.
   */
  app.get("/content/files/:fileId", limit(600), async (req, reply) => {
    const { fileId } = parseInput(z.object({ fileId: uuidSchema }), req.params);
    const { width } = parseInput(mediaQuery, req.query);
    const ctx = await optionalCtx(req.headers.authorization);
    const file = await content.file(fileId, ctx?.level ?? "visitor", !!ctx, width);
    if (file.access !== "allow") {
      if (file.access === "unauthenticated")
        throw unauthorized("Bitte melde dich an, um diese Datei zu öffnen.");
      if (file.access === "forbidden") throw forbidden();
      throw notFound("Datei nicht gefunden.");
    }
    reply
      .type(file.contentType)
      .header("cache-control", file.isPublic ? "public, max-age=3600" : "private, no-store")
      .header("x-content-type-options", "nosniff");
    if (file.contentDisposition) reply.header("content-disposition", file.contentDisposition);
    return reply.send(file.body);
  });

  // --- internal area (authenticated) ------------------------------------------------

  /** Menus for the user's level (internal menu + main/footer as seen by this user). */
  app.get("/internal/navigation", limit(240), async (req) => {
    const ctx = await auth.authenticate(req.headers.authorization);
    return content.navigation(ctx.level);
  });

  /** Page for the internal area: 404 if missing, 403 if the level is insufficient. */
  app.get("/internal/pages", limit(240), async (req) => {
    const ctx = await auth.authenticate(req.headers.authorization);
    return content.page(parseInput(pathQuery, req.query).path, ctx.level, {
      forbiddenIfHidden: true,
    });
  });

  /** Status check for the Next.js proxy (/intern/seiten/<path>). */
  app.get("/internal/pages/resolve", limit(1200), async (req) => {
    const ctx = await auth.authenticate(req.headers.authorization);
    return content.resolveInternalPage(parseInput(pathQuery, req.query).path, ctx.level);
  });
};
