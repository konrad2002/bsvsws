import { uuidSchema } from "@bsv-sws/validation";
import { env } from "@/lib/env";

/**
 * Public club logo, proxied from Fastify (the browser never talks to Fastify).
 * Directus files are not publicly readable; Fastify serves only the club's logo.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/clubs/[clubId]/logo">) {
  const { clubId } = await params;
  if (!uuidSchema.safeParse(clubId).success) return new Response(null, { status: 404 });
  const res = await fetch(new URL(`/clubs/${clubId}/logo`, env.API_URL), { cache: "no-store" });
  if (!res.ok || !res.body) return new Response(null, { status: 404 });
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
