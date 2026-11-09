import { publicEventQuerySchema } from "@bsv-sws/validation";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { notFound, parseInput } from "../lib/errors.js";
import type { PublicEventService } from "../modules/public-calendar/public-event-service.js";

const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) });
const feedParams = z.object({ feed: z.string().regex(/^[a-z]{1,30}\.ics$/) });

/** Public, unauthenticated calendar endpoints (spec §7.12–7.13). Only published events. */
export const publicRoutes: FastifyPluginAsync<{ events: PublicEventService }> = async (
  app,
  { events },
) => {
  const limit = (max: number) => ({ config: { rateLimit: { max, timeWindow: "1 minute" } } });

  app.get("/public/events", limit(120), async (req) =>
    events.list(parseInput(publicEventQuerySchema, req.query)),
  );

  app.get("/public/events/:slug", limit(120), async (req) =>
    events.get(parseInput(slugParams, req.params).slug),
  );

  app.get("/public/calendar-filters", limit(120), async () => events.filters());

  app.get("/public/calendar/:feed", limit(60), async (req, reply) => {
    const { feed } = parseInput(feedParams, req.params);
    const ics = await events.feed(feed.replace(/\.ics$/, ""));
    if (!ics) throw notFound("Kalender nicht gefunden.");
    return reply
      .type("text/calendar; charset=utf-8")
      .header("cache-control", "public, max-age=900")
      .header("content-disposition", `inline; filename="bsv-sws-${feed}"`)
      .send(ics);
  });
};
