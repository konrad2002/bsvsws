import { z } from "zod";

/**
 * API configuration, validated at startup. Never log secret values.
 * Variable names are documented in the root .env.example.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  /** Internal Directus URL as reachable from the API. */
  DIRECTUS_URL: z.url(),
  /** Static token of the restricted Fastify service account (created by `pnpm directus:apply`). */
  DIRECTUS_SERVICE_TOKEN: z
    .string({ error: "DIRECTUS_SERVICE_TOKEN is required" })
    .min(32, "DIRECTUS_SERVICE_TOKEN must be at least 32 characters"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid API environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
