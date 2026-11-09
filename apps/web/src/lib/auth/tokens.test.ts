import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { accessTokenExpiresAt, needsRefresh } = await import("./tokens");

const jwt = (payload: object) =>
  ["e30", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");

describe("token expiry helpers", () => {
  it("reads exp from a JWT", () => {
    expect(accessTokenExpiresAt(jwt({ exp: 1234 }))).toBe(1234);
    expect(accessTokenExpiresAt("not-a-jwt")).toBeNull();
  });

  it("refreshes when missing, unreadable or about to expire", () => {
    expect(needsRefresh(undefined, 1000)).toBe(true);
    expect(needsRefresh("garbage", 1000)).toBe(true);
    expect(needsRefresh(jwt({ exp: 1030 }), 1000)).toBe(true);
    expect(needsRefresh(jwt({ exp: 2000 }), 1000)).toBe(false);
  });
});
