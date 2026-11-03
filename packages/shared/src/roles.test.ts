import { describe, expect, it } from "vitest";
import { VISIBILITY_LABELS, VISIBILITY_LEVELS } from "./roles.js";

describe("visibility levels", () => {
  it("has exactly four fixed levels with German labels", () => {
    expect(VISIBILITY_LEVELS).toHaveLength(4);
    for (const level of VISIBILITY_LEVELS) expect(VISIBILITY_LABELS[level]).toBeTruthy();
  });
});
