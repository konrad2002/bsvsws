import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/intern/verein", "/intern/verein"],
    ["/", "/"],
    ["https://evil.example", "/intern"],
    ["//evil.example", "/intern"],
    ["/\\evil.example", "/intern"],
    [null, "/intern"],
  ])("%s → %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
