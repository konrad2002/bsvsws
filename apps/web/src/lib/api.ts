import "server-only";
import { apiErrorSchema } from "@bsv-sws/validation";
import { cookies, headers as requestHeaders } from "next/headers";
import { ACCESS_COOKIE } from "./auth/tokens";
import { env } from "./env";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/**
 * Calls the Fastify API from the Next.js server, forwarding the user's Directus
 * access token from the HTTP-only cookie and the browser's IP (for Fastify's
 * rate limits). The browser never talks to Fastify.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const [cookieStore, incoming] = await Promise.all([cookies(), requestHeaders()]);
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  const clientIp =
    incoming.get("x-forwarded-for")?.split(",")[0]?.trim() || incoming.get("x-real-ip");
  if (clientIp) headers.set("x-client-ip", clientIp);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(new URL(path, env.API_URL), { ...init, headers, cache: "no-store" });
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    const error = parsed.success
      ? parsed.data.error
      : { code: "UNKNOWN", message: "Unerwartete Antwort des Servers.", details: undefined };
    throw new ApiRequestError(res.status, error.code, error.message, error.details);
  }
  return body as T;
}

export const jsonBody = (data: unknown): RequestInit["body"] => JSON.stringify(data);
