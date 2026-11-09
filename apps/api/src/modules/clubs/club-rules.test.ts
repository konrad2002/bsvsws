import { describe, expect, it } from "vitest";
import type { AuthContext } from "../auth/auth-service.js";
import { assertCanUpdateClub, diffFields } from "./club-rules.js";

const CLUB_A = "00000000-0000-4000-8000-00000000000a";
const CLUB_B = "00000000-0000-4000-8000-00000000000b";
const rep: AuthContext = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "rep@example.com",
  firstName: null,
  lastName: null,
  accountRole: "user",
  level: "club_representative",
  membership: {
    id: "00000000-0000-4000-8000-0000000000ff",
    role: "representative",
    club: { id: CLUB_A, name: "A", slug: "a" },
  },
};
const federation: AuthContext = {
  ...rep,
  accountRole: "federation",
  level: "federation",
  membership: null,
};

describe("club update rules", () => {
  it("representative may edit permitted fields of own club", () => {
    expect(() =>
      assertCanUpdateClub(rep, CLUB_A, { website: "https://a.de", sports: ["swimming"] }),
    ).not.toThrow();
  });

  it("representative may not edit name, slug or active", () => {
    for (const input of [{ name: "X" }, { slug: "x" }, { active: false }]) {
      expect(() => assertCanUpdateClub(rep, CLUB_A, input)).toThrow(
        expect.objectContaining({ code: "FIELDS_NOT_ALLOWED" }),
      );
    }
  });

  it("representative may not edit another club", () => {
    expect(() => assertCanUpdateClub(rep, CLUB_B, { website: null })).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("federation may edit everything", () => {
    expect(() =>
      assertCanUpdateClub(federation, CLUB_B, { name: "X", slug: "x", active: false }),
    ).not.toThrow();
  });
});

describe("diffFields", () => {
  it("reports only changed fields", () => {
    const result = diffFields({ a: 1, b: "x", c: ["s"] }, { a: 1, b: "y", c: ["s"] });
    expect(result).toEqual({ before: { b: "x" }, after: { b: "y" }, changed: true });
    expect(diffFields({ a: null }, { a: null }).changed).toBe(false);
  });
});
