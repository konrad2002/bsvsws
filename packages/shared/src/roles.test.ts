import { describe, expect, it } from "vitest";
import {
  canSeeVisibility,
  deriveUserLevel,
  VISIBILITY_LABELS,
  VISIBILITY_LEVELS,
  type UserLevel,
  type VisibilityLevel,
} from "./roles.js";

describe("visibility levels", () => {
  it("has exactly four fixed levels with German labels", () => {
    expect(VISIBILITY_LEVELS).toHaveLength(4);
    for (const level of VISIBILITY_LEVELS) expect(VISIBILITY_LABELS[level]).toBeTruthy();
  });
});

describe("deriveUserLevel", () => {
  it.each([
    ["administrator", null, "administrator"],
    ["administrator", "member", "administrator"],
    ["federation", null, "federation"],
    ["federation", "representative", "federation"],
    ["user", "representative", "club_representative"],
    ["user", "member", "club_member"],
    ["user", null, "visitor"],
    [null, null, "visitor"],
  ] as const)("account %s + membership %s → %s", (account, membership, expected) => {
    expect(deriveUserLevel(account, membership)).toBe(expected);
  });
});

describe("canSeeVisibility (spec §8.4 matrix)", () => {
  const matrix: Record<UserLevel, VisibilityLevel[]> = {
    visitor: ["public"],
    club_member: ["public", "club"],
    club_representative: ["public", "club", "club_representative"],
    federation: ["public", "club", "club_representative", "federation"],
    administrator: ["public", "club", "club_representative", "federation"],
  };

  for (const [level, allowed] of Object.entries(matrix) as [UserLevel, VisibilityLevel[]][]) {
    for (const visibility of VISIBILITY_LEVELS) {
      const expected = allowed.includes(visibility);
      it(`${level} ${expected ? "can" : "cannot"} see ${visibility}`, () => {
        expect(canSeeVisibility(level, visibility)).toBe(expected);
      });
    }
  }
});
