import { env } from "@/lib/env";

/**
 * Container healthcheck / uptime probe: the Next.js server is up and reaches the
 * API. Never cached; reveals nothing beyond "ok".
 */
export async function GET() {
  try {
    const res = await fetch(new URL("/health", env.API_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(String(res.status));
    return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
