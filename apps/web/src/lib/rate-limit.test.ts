import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit within a window, then blocks", () => {
    let now = 0;
    const limiter = new RateLimiter(3, 1000, () => now);
    expect([1, 2, 3].map(() => limiter.attempt("ip"))).toEqual([true, true, true]);
    expect(limiter.attempt("ip")).toBe(false);
    now = 1000;
    expect(limiter.attempt("ip")).toBe(true);
  });

  it("tracks keys independently and can be reset", () => {
    const limiter = new RateLimiter(1, 1000, () => 0);
    expect(limiter.attempt("a")).toBe(true);
    expect(limiter.attempt("b")).toBe(true);
    expect(limiter.attempt("a")).toBe(false);
    limiter.reset("a");
    expect(limiter.attempt("a")).toBe(true);
  });
});
