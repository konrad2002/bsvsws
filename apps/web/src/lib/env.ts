import "server-only";
import { z } from "zod";

/** Server-side web configuration. Secrets here must never reach client components. */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Directus URL as reachable from the Next.js server. */
  DIRECTUS_URL: z.url().default("http://localhost:8055"),
  /** Directus Studio URL as reachable from the browser (links for federation users). */
  DIRECTUS_PUBLIC_URL: z.url().optional(),
  /** Fastify API URL as reachable from the Next.js server. */
  API_URL: z.url().default("http://localhost:4000"),
  /** Send session cookies only over HTTPS. Defaults to true in production. */
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  directusPublicUrl: parsed.DIRECTUS_PUBLIC_URL ?? parsed.DIRECTUS_URL,
  sessionCookieSecure: parsed.SESSION_COOKIE_SECURE
    ? parsed.SESSION_COOKIE_SECURE === "true"
    : parsed.NODE_ENV === "production",
};
