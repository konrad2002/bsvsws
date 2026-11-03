import { describe, expect, it } from "vitest";
import type { AuthContext } from "../auth/auth-service.js";
import { assertCanChangeRole, assertCanRemove, roleChangeAction } from "./membership-rules.js";

const CLUB_A = "00000000-0000-4000-8000-00000000000a";
const CLUB_B = "00000000-0000-4000-8000-00000000000b";
const REP_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";

const base: AuthContext = {
  id: REP_ID,
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
const member: AuthContext = {
  ...base,
  level: "club_member",
  membership: { ...base.membership!, role: "member" },
};
const federation: AuthContext = {
  ...base,
  accountRole: "federation",
  level: "federation",
  membership: null,
};

const otherMember = { userId: OTHER_ID, clubId: CLUB_A, role: "member" as const };

describe("membership rules", () => {
  it("representative can promote and remove other members of own club", () => {
    expect(() => assertCanChangeRole(base, otherMember, "representative")).not.toThrow();
    expect(() => assertCanRemove(base, otherMember)).not.toThrow();
  });

  it("representative cannot touch another club", () => {
    const foreign = { ...otherMember, clubId: CLUB_B };
    expect(() => assertCanChangeRole(base, foreign, "representative")).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
    expect(() => assertCanRemove(base, foreign)).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("ordinary members cannot promote, demote or remove", () => {
    expect(() => assertCanChangeRole(member, otherMember, "representative")).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
    expect(() => assertCanRemove(member, otherMember)).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("representatives cannot demote or remove themselves (owner decision)", () => {
    const self = { userId: REP_ID, clubId: CLUB_A, role: "representative" as const };
    expect(() => assertCanChangeRole(base, self, "member")).toThrow(
      expect.objectContaining({ code: "SELF_CHANGE_NOT_ALLOWED" }),
    );
    expect(() => assertCanRemove(base, self)).toThrow(
      expect.objectContaining({ code: "SELF_CHANGE_NOT_ALLOWED" }),
    );
  });

  it("federation can override any assignment, including its own", () => {
    expect(() =>
      assertCanChangeRole(federation, { ...otherMember, clubId: CLUB_B }, "representative"),
    ).not.toThrow();
    expect(() =>
      assertCanRemove(federation, { userId: REP_ID, clubId: CLUB_A, role: "member" }),
    ).not.toThrow();
  });

  it("rejects no-op role changes", () => {
    expect(() => assertCanChangeRole(base, otherMember, "member")).toThrow(
      expect.objectContaining({ code: "ROLE_UNCHANGED" }),
    );
  });

  it("maps role changes to audit actions", () => {
    expect(roleChangeAction("representative")).toBe("membership.promoted");
    expect(roleChangeAction("member")).toBe("membership.demoted");
  });
});
