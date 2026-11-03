import { describe, expect, it } from "vitest";
import {
  generateToken,
  generateVerificationCode,
  hmacCode,
  safeEqualHex,
  sha256,
} from "./crypto.js";

describe("crypto helpers", () => {
  it("generates 43-char url-safe tokens", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(token);
  });

  it("generates 6-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(generateVerificationCode()).toMatch(/^\d{6}$/);
  });

  it("binds code hashes to secret and context", () => {
    const h = hmacCode("secret", "inv-1", "123456");
    expect(safeEqualHex(h, hmacCode("secret", "inv-1", "123456"))).toBe(true);
    expect(safeEqualHex(h, hmacCode("secret", "inv-2", "123456"))).toBe(false);
    expect(safeEqualHex(h, hmacCode("other", "inv-1", "123456"))).toBe(false);
    expect(safeEqualHex(h, sha256("x").slice(0, 10))).toBe(false);
  });
});
