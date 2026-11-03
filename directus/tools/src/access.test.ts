import { describe, expect, it } from "vitest";
import { assertNoCustomRules, POLICIES, PUBLIC_PERMISSIONS, ROLES } from "./access.js";

describe("access configuration", () => {
  it("uses no licence-gated custom permission rules", () => {
    expect(() =>
      assertNoCustomRules([...POLICIES.flatMap((p) => p.permissions), ...PUBLIC_PERMISSIONS]),
    ).not.toThrow();
  });

  it("detects field restrictions and filters", () => {
    expect(() =>
      assertNoCustomRules([{ collection: "x", action: "read", fields: ["id"] }]),
    ).toThrow();
    expect(() =>
      assertNoCustomRules([
        { collection: "x", action: "read", fields: ["*"], permissions: { a: 1 } },
      ]),
    ).toThrow();
  });

  it("never grants delete, and never lets anyone but the service account write workflow data", () => {
    for (const policy of POLICIES) {
      for (const p of policy.permissions) {
        expect(p.action).not.toBe("delete");
        if (p.action !== "read") expect(policy.name).toBe("API-Servicekonto");
      }
    }
    expect(PUBLIC_PERMISSIONS.every((p) => p.action === "read")).toBe(true);
  });

  it("gives club users (role Benutzer) no Directus permissions", () => {
    expect(ROLES.find((r) => r.name === "Benutzer")?.policies).toEqual([]);
  });
});
