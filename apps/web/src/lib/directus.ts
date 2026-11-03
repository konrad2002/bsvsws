import "server-only";
import { createPublicClient } from "@bsv-sws/directus";
import { env } from "./env";

/** Anonymous Directus client for public content reads (server components only). */
export const directusPublic = createPublicClient(env.DIRECTUS_URL);
