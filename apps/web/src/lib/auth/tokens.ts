import "server-only";
import { createDirectus, login, logout, refresh, rest } from "@directus/sdk";
import { env } from "../env";

/**
 * Directus token handling for the backend-for-frontend session (docs/02-architecture.md).
 * Tokens live only in HTTP-only cookies and server memory – never in client JS.
 */

export const ACCESS_COOKIE = "bsv_access";
export const REFRESH_COOKIE = "bsv_refresh";
/** Must match Directus REFRESH_TOKEN_TTL (infrastructure/compose/compose.yml). */
export const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
/** Refresh the access token when it expires within this window. */
export const REFRESH_LEEWAY_SECONDS = 60;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in milliseconds. */
  expiresMs: number;
}

export interface CookieSpec {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
  };
}

const directus = () => createDirectus(env.DIRECTUS_URL).with(rest());

function toTokens(data: {
  access_token: string | null;
  refresh_token: string | null;
  expires: number | null;
}): SessionTokens {
  if (!data.access_token || !data.refresh_token || !data.expires) {
    throw new Error("Directus returned incomplete authentication data");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresMs: data.expires,
  };
}

/** Throws on invalid credentials or suspended accounts. */
export async function directusLogin(email: string, password: string): Promise<SessionTokens> {
  return toTokens(await directus().request(login({ email, password }, { mode: "json" })));
}

/**
 * Directus rotates refresh tokens, so two parallel requests refreshing with the
 * same token would log the user out (the second one fails). Concurrent and
 * recent refreshes of the same token therefore share one result (per process).
 */
const REFRESH_REUSE_MS = 30_000;
const recentRefreshes = new Map<string, { result: Promise<SessionTokens | null>; at: number }>();

/** Returns null if the refresh token is invalid/expired. */
export async function directusRefresh(refreshToken: string): Promise<SessionTokens | null> {
  const now = Date.now();
  for (const [key, entry] of recentRefreshes)
    if (now - entry.at > REFRESH_REUSE_MS) recentRefreshes.delete(key);

  const existing = recentRefreshes.get(refreshToken);
  if (existing) return existing.result;

  const result = directus()
    .request(refresh({ refresh_token: refreshToken, mode: "json" }))
    .then(toTokens)
    .catch(() => null);
  recentRefreshes.set(refreshToken, { result, at: now });
  return result;
}

/** Invalidates the session in Directus. Errors are ignored (cookies are cleared anyway). */
export async function directusLogout(refreshToken: string): Promise<void> {
  try {
    await directus().request(logout({ refresh_token: refreshToken, mode: "json" }));
  } catch {
    // already invalid
  }
}

export function sessionCookies(tokens: SessionTokens): CookieSpec[] {
  const base = {
    httpOnly: true,
    secure: env.sessionCookieSecure,
    sameSite: "lax",
    path: "/",
  } as const;
  return [
    {
      name: ACCESS_COOKIE,
      value: tokens.accessToken,
      options: { ...base, maxAge: Math.floor(tokens.expiresMs / 1000) },
    },
    {
      name: REFRESH_COOKIE,
      value: tokens.refreshToken,
      options: { ...base, maxAge: REFRESH_MAX_AGE_SECONDS },
    },
  ];
}

/**
 * Reads the `exp` claim WITHOUT verifying the signature. Only used to decide
 * when to refresh – the token is always verified by Directus/Fastify on use.
 */
export function accessTokenExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    );
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function needsRefresh(
  accessToken: string | undefined,
  nowSeconds = Date.now() / 1000,
): boolean {
  if (!accessToken) return true;
  const exp = accessTokenExpiresAt(accessToken);
  return exp === null || exp - nowSeconds < REFRESH_LEEWAY_SECONDS;
}
