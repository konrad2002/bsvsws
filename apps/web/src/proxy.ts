import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  directusRefresh,
  needsRefresh,
  REFRESH_COOKIE,
  sessionCookies,
} from "./lib/auth/tokens";
import {
  INTERNAL_PAGES_PREFIX,
  isContentPath,
  isDocumentRequest,
  resolveContentPath,
  resolveInternalPage,
} from "./lib/content-resolution";

/**
 * Next.js 16 "proxy" (formerly middleware), runs before rendering:
 *
 * 1. Real status codes for public content: missing pages/articles/events/clubs
 *    get HTTP 404, legacy URLs a real 307/308 (streamed pages are always 200).
 * 2. Session refresh: Server Components cannot set cookies, so the access token
 *    is refreshed here; new cookies go to the browser (response) AND to the
 *    current render (request).
 * 3. Optimistic redirect for the internal area. Real authorization happens in
 *    Fastify / the data access layer, never here.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    isDocumentRequest(request.headers, request.method) &&
    isContentPath(pathname) &&
    !request.headers.has(RENDER_404_HEADER)
  ) {
    const resolution = await resolveContentPath(pathname, search);
    if (resolution.action === "redirect") {
      return NextResponse.redirect(
        new URL(resolution.to, request.url),
        resolution.permanent ? 308 : 307,
      );
    }
    if (resolution.action === "not_found") {
      const notFoundPage = await renderWithStatus(request, 404);
      if (notFoundPage) return notFoundPage;
    }
  }

  // Protected CMS pages: real 403/404 and redirect of public pages (owner decision: 403).
  const sessionToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (
    sessionToken &&
    isDocumentRequest(request.headers, request.method) &&
    pathname.startsWith(`${INTERNAL_PAGES_PREFIX}/`) &&
    !request.headers.has(RENDER_404_HEADER)
  ) {
    const resolution = await resolveInternalPage(pathname, sessionToken);
    if (resolution.action === "redirect") {
      return NextResponse.redirect(
        new URL(resolution.to, request.url),
        resolution.permanent ? 308 : 307,
      );
    }
    if (resolution.action === "forbidden" || resolution.action === "not_found") {
      const page = await renderWithStatus(request, resolution.action === "forbidden" ? 403 : 404);
      if (page) return page;
    }
  }

  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const isInternal = pathname.startsWith("/intern");

  if (refreshToken && needsRefresh(access)) {
    const tokens = await directusRefresh(refreshToken);
    if (tokens) {
      const cookies = sessionCookies(tokens);
      for (const c of cookies) request.cookies.set(c.name, c.value);
      const response = NextResponse.next({ request: { headers: request.headers } });
      for (const c of cookies) response.cookies.set(c.name, c.value, c.options);
      return response;
    }
    // Refresh token invalid/expired → session is over.
    request.cookies.delete(ACCESS_COOKIE);
    request.cookies.delete(REFRESH_COOKIE);
    const response = isInternal
      ? NextResponse.redirect(loginUrl(request))
      : NextResponse.next({ request: { headers: request.headers } });
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  if (isInternal && !access && !refreshToken) {
    return NextResponse.redirect(loginUrl(request));
  }
  return NextResponse.next();
}

/** Marks the internal self-request so it is not resolved again (loop guard). */
const RENDER_404_HEADER = "x-bsv-render-404";

/**
 * Production streams a prerendered shell with status 200, so a status set here
 * would be overridden. For confirmed 404/403 we therefore render the page
 * ourselves (it shows the regular not-found / no-access UI with full layout) and
 * return the complete HTML with the real status – needed for link checkers.
 */
async function renderWithStatus(request: NextRequest, status: 403 | 404): Promise<Response | null> {
  try {
    const port = process.env.PORT || request.nextUrl.port || "3000";
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      `http://127.0.0.1:${port}`,
    );
    const res = await fetch(target, {
      headers: {
        [RENDER_404_HEADER]: "1",
        "accept-language": request.headers.get("accept-language") ?? "de",
        "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
        "x-forwarded-host": request.headers.get("host") ?? "",
        // internal pages need the session to render the no-access/not-found UI
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return new Response(await res.text(), {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    return null; // fall back to the streamed page (200 + noindex)
  }
}

function loginUrl(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return url;
}

export const config = {
  // Skip static assets and image optimisation.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
