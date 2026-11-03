import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

describe("health routes", async () => {
  const app = await buildApp(loadEnv({ DIRECTUS_URL: "http://127.0.0.1:1" }), { logger: false });
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
});
