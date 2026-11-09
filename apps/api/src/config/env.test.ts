import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

const TOKEN = "x".repeat(32);
const BASE = { DIRECTUS_SERVICE_TOKEN: TOKEN, APP_SECRET: "s".repeat(32) };

describe("loadEnv", () => {
  it("applies defaults", () => {
    const env = loadEnv({ ...BASE, DIRECTUS_URL: "http://directus:8055" });
    expect(env.API_PORT).toBe(4000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.INVITATION_TTL_DAYS).toBe(14);
    expect(env.SMTP_SECURE).toBe(false);
  });

  it("requires APP_SECRET", () => {
    expect(() => loadEnv({ DIRECTUS_URL: "http://d:8055", DIRECTUS_SERVICE_TOKEN: TOKEN })).toThrow(
      /APP_SECRET/,
    );
  });

  it("requires a service token", () => {
    expect(() =>
      loadEnv({ ...BASE, DIRECTUS_URL: "http://directus:8055", DIRECTUS_SERVICE_TOKEN: "" }),
    ).toThrow(/DIRECTUS_SERVICE_TOKEN/);
  });

  it("rejects a missing DIRECTUS_URL", () => {
    expect(() => loadEnv(BASE)).toThrow(/DIRECTUS_URL/);
  });
});
