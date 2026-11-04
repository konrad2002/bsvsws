import "server-only";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "./auth/tokens";
import { env } from "./env";

/**
 * Streams a file from Fastify to the browser, forwarding the session token if
 * present (Fastify decides: published = public, otherwise authorized users only).
 */
export async function proxyAsset(path: string): Promise<Response> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const res = await fetch(new URL(path, env.API_URL), {
    cache: "no-store",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok || !res.body) return new Response(null, { status: 404 });
  const headers = new Headers({
    "content-type": res.headers.get("content-type") ?? "application/octet-stream",
    "cache-control": "private, max-age=60",
    "x-content-type-options": "nosniff",
  });
  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(res.body, { headers });
}
