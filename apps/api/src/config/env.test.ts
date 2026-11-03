import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

const TOKEN = "x".repeat(32);

describe("loadEnv", () => {
  it("applies defaults", () => {
    const env = loadEnv({ DIRECTUS_URL: "http://directus:8055", DIRECTUS_SERVICE_TOKEN: TOKEN });
    expect(env.API_PORT).toBe(4000);
    expect(env.NODE_ENV).toBe("development");
  });

  it("requires a service token", () => {
    expect(() =>
      loadEnv({ DIRECTUS_URL: "http://directus:8055", DIRECTUS_SERVICE_TOKEN: "" }),
    ).toThrow(/DIRECTUS_SERVICE_TOKEN/);
  });

  it("rejects a missing DIRECTUS_URL", () => {
    expect(() => loadEnv({ DIRECTUS_SERVICE_TOKEN: TOKEN })).toThrow(/DIRECTUS_URL/);
  });
});
