import { DIRECTUS_ROLE_IDS } from "@bsv-sws/directus";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import type { IdentityProvider } from "./modules/auth/identity-provider.js";

const env = loadEnv({
  DIRECTUS_URL: "http://127.0.0.1:1",
  DIRECTUS_SERVICE_TOKEN: "x".repeat(32),
  APP_SECRET: "s".repeat(32),
});

const identity: IdentityProvider = {
  verifyToken: async (token) =>
    token === "valid"
      ? { userId: "00000000-0000-4000-8000-000000000001", adminAccess: false }
      : null,
  getUser: async (id) => ({
    id,
    email: "mitglied@example.com",
    first_name: "Erika",
    last_name: "Muster",
    status: "active",
    role: DIRECTUS_ROLE_IDS.user,
    phone: null,
  }),
  getActiveMembership: async () => ({
    id: "00000000-0000-4000-8000-0000000000ff",
    role: "member",
    club: { id: "00000000-0000-4000-8000-00000000000a", name: "SV A", slug: "sv-a" },
  }),
};

describe("app", async () => {
  const app = await buildApp(env, { logger: false }, { identity });
  afterAll(() => app.close());

  it("GET /health reports liveness", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("GET /health/ready returns 503 when Directus is unreachable", async () => {
    const res = await app.inject({ method: "GET", url: "/health/ready" });
    expect(res.statusCode).toBe(503);
  });

  it("GET /me without token returns the uniform 401 error body", async () => {
    const res = await app.inject({ method: "GET", url: "/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("GET /me with a valid token returns the session user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: "Bearer valid" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      level: "club_member",
      membership: { club: { slug: "sv-a" } },
    });
  });

  it("unknown routes return the uniform 404 body", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});
