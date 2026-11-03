import { createDirectus, rest, staticToken, type RestClient } from "@directus/sdk";
import type { DirectusSchema } from "./schema.js";

export type AppDirectusClient = RestClient<DirectusSchema>;

/**
 * Anonymous client for public reads (Next.js → Directus).
 * Directus public policy decides what is readable.
 */
export function createPublicClient(url: string) {
  return createDirectus<DirectusSchema>(url).with(rest());
}

/**
 * Client authenticated with a static token, e.g. the restricted Fastify
 * service account. SERVER-SIDE ONLY – never expose the token to browsers.
 * Remember: Directus sees the service account, not the end user; Fastify must
 * enforce the end user's permissions itself (spec §3.4).
 */
export function createTokenClient(url: string, token: string) {
  return createDirectus<DirectusSchema>(url).with(staticToken(token)).with(rest());
}
