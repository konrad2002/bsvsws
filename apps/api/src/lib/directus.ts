import { createTokenClient } from "@bsv-sws/directus";

/** Directus client authenticated as the Fastify service account. Server-only. */
export type ServiceClient = ReturnType<typeof createTokenClient>;

export function createServiceClient(directusUrl: string, serviceToken: string): ServiceClient {
  return createTokenClient(directusUrl, serviceToken);
}
