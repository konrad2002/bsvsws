import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((v) => v === "true");

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
  /** Secret for HMACs (verification codes). Rotating it invalidates pending codes only. */
  APP_SECRET: z
    .string({ error: "APP_SECRET is required" })
    .min(32, "APP_SECRET must be at least 32 characters"),
  /** Public base URL of the website, used in email links. */
  WEB_PUBLIC_URL: z.url().default("http://localhost:3000"),
  /** Validity of invitation links in days (spec §5.2: configurable). */
  INVITATION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: bool.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("BSV-SWS <no-reply@bsv-sws.de>"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Treat empty strings like unset (Compose passes `VAR=` as empty string).
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ""));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new Error(`Invalid API environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
