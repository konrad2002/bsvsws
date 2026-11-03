import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("applies defaults", () => {
    const env = loadEnv({ DIRECTUS_URL: "http://directus:8055" });
    expect(env.API_PORT).toBe(4000);
    expect(env.NODE_ENV).toBe("development");
  });

  it("treats an empty service token as unset", () => {
    const env = loadEnv({ DIRECTUS_URL: "http://directus:8055", DIRECTUS_SERVICE_TOKEN: "" });
    expect(env.DIRECTUS_SERVICE_TOKEN).toBeUndefined();
  });

  it("rejects a missing DIRECTUS_URL", () => {
    expect(() => loadEnv({})).toThrow(/DIRECTUS_URL/);
  });
});
