import "server-only";
import { headers } from "next/headers";
import { env } from "./env";

/**
 * Fetch from Fastify's public endpoints. Never sends the session token (public
 * pages look the same for everyone); forwards the visitor's IP for rate limits.
 */
export async function publicFetch(path: string): Promise<Response> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  return fetch(new URL(path, env.API_URL), {
    cache: "no-store",
    headers: ip ? { "x-client-ip": ip } : {},
  });
}

/** JSON body, or null for 404. Other errors throw (→ error page). */
export async function publicJson(path: string): Promise<unknown> {
  const res = await publicFetch(path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Public API ${path} failed with ${res.status}`);
  return res.json();
}
