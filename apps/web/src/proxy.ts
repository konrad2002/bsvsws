import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  directusRefresh,
  needsRefresh,
  REFRESH_COOKIE,
  sessionCookies,
} from "./lib/auth/tokens";

/**
 * Session refresh (Next.js 16 "proxy", formerly middleware).
 * Server Components cannot set cookies, so the access token is refreshed here
 * before rendering: new cookies go to the browser (response) AND to the current
 * render (request), so the page already uses the fresh token.
 *
 * Also an optimistic redirect for the internal area. Real authorization happens
 * in Fastify / the data access layer, never here.
 */
export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const isInternal = request.nextUrl.pathname.startsWith("/intern");

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
