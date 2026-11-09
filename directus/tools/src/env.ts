import { createDirectus, rest, staticToken } from "@directus/sdk";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const envSchema = z.object({
  /** Directus URL reachable from where the tool runs. */
  DIRECTUS_URL: z.url(),
  /**
   * Admin token used for setup. Deployed environments pass a dedicated
   * DIRECTUS_SETUP_TOKEN; locally the bootstrap DIRECTUS_ADMIN_TOKEN is used.
   */
  DIRECTUS_SETUP_TOKEN: z.string().optional(),
  DIRECTUS_ADMIN_TOKEN: z.string().optional(),
  DIRECTUS_SERVICE_TOKEN: z.string().optional(),
  DEV_SEED_PASSWORD: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export function adminClient() {
  const token = env.DIRECTUS_SETUP_TOKEN || env.DIRECTUS_ADMIN_TOKEN;
  if (!token) throw new Error("Set DIRECTUS_SETUP_TOKEN (or DIRECTUS_ADMIN_TOKEN locally).");
  // Untyped on purpose: the tools operate on system collections and raw snapshots.
  return createDirectus(env.DIRECTUS_URL).with(staticToken(token)).with(rest());
}

export const SNAPSHOT_PATH = fileURLToPath(new URL("../../snapshots/schema.json", import.meta.url));
