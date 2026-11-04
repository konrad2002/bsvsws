import { describe, expect, it } from "vitest";
import { FailureLimiter } from "./rate-limit";

describe("FailureLimiter", () => {
  it("blocks after the configured number of failures within the window", () => {
    let now = 0;
    const limiter = new FailureLimiter(3, 1000, () => now);
    for (let i = 0; i < 3; i++) {
      expect(limiter.isBlocked("ip")).toBe(false);
      limiter.recordFailure("ip");
    }
    expect(limiter.isBlocked("ip")).toBe(true);
    now = 1000;
    expect(limiter.isBlocked("ip")).toBe(false);
  });

  it("does not count successes (checking is free)", () => {
    const limiter = new FailureLimiter(1, 1000, () => 0);
    for (let i = 0; i < 100; i++) expect(limiter.isBlocked("ip")).toBe(false);
  });

  it("tracks keys independently and can be reset", () => {
    const limiter = new FailureLimiter(1, 1000, () => 0);
    limiter.recordFailure("a");
    expect(limiter.isBlocked("a")).toBe(true);
    expect(limiter.isBlocked("b")).toBe(false);
    limiter.reset("a");
    expect(limiter.isBlocked("a")).toBe(false);
  });
});
