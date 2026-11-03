import "server-only";
import { z } from "zod";

/** Server-side web configuration. Secrets here must never reach client components. */
const envSchema = z.object({
  /** Directus URL as reachable from the Next.js server. */
  DIRECTUS_URL: z.url().default("http://localhost:8055"),
  /** Fastify API URL as reachable from the Next.js server. */
  API_URL: z.url().default("http://localhost:4000"),
});

export const env = envSchema.parse(process.env);
