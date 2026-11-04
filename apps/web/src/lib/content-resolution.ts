import "server-only";
import { env } from "./env";

/**
 * Real HTTP status codes for public content (Proxy, before rendering).
 * Streamed responses always start with 200, so missing pages/articles/events/
 * clubs and legacy URLs are resolved here first (Next 16 docs: "check the slug
 * in Proxy"). One fast API call per *document* request on content paths only.
 */

const STATIC_EXACT = new Set(["/", "/news", "/veranstaltungen", "/vereine", "/login"]);
const APP_PREFIXES = ["/intern", "/einladung", "/api", "/kalender", "/medien", "/_next"];

/** Paths whose existence depends on CMS/workflow data (detail routes + catch-all). */
export function isContentPath(pathname: string): boolean {
  if (STATIC_EXACT.has(pathname)) return false;
  if (APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  // Static assets – but NOT legacy page URLs like /index.php or /foo.html (redirect candidates).
  if (
    /\.(?:txt|xml|ico|png|jpe?g|gif|svg|webp|avif|css|js|map|json|woff2?|webmanifest)$/i.test(
      pathname,
    )
  )
    return false;
  return true;
}

/** Only full page loads need a status code; client navigations/prefetches (RSC) don't. */
export function isDocumentRequest(headers: Headers, method: string): boolean {
  return method === "GET" && !headers.has("rsc") && !headers.has("next-router-prefetch");
}

export type Resolution =
  | { action: "ok" }
  | { action: "redirect"; to: string; permanent: boolean }
  | { action: "not_found" };

/** Fails open: if the API is unavailable the page renders normally. */
export async function resolveContentPath(pathname: string, search: string): Promise<Resolution> {
  try {
    const params = new URLSearchParams({
      path: decodeURIComponent(pathname),
      query: search.replace(/^\?/, ""),
    });
    const res = await fetch(new URL(`/public/resolve?${params}`, env.API_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { action: "ok" };
    return (await res.json()) as Resolution;
  } catch {
    return { action: "ok" };
  }
}

export type InternalResolution = Resolution | { action: "forbidden" };

export const INTERNAL_PAGES_PREFIX = "/intern/seiten";

/** Status for protected CMS pages (/intern/seiten/<path>), as the logged-in user. Fails open. */
export async function resolveInternalPage(
  pathname: string,
  accessToken: string,
): Promise<InternalResolution> {
  try {
    const path = decodeURIComponent(pathname.slice(INTERNAL_PAGES_PREFIX.length)) || "/";
    const res = await fetch(
      new URL(`/internal/pages/resolve?${new URLSearchParams({ path })}`, env.API_URL),
      {
        cache: "no-store",
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(2000),
      },
    );
    if (!res.ok) return { action: "ok" }; // e.g. expired token → refresh below, page decides
    return (await res.json()) as InternalResolution;
  } catch {
    return { action: "ok" };
  }
}
