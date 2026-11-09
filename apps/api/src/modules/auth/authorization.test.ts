import { describe, expect, it } from "vitest";
import type { AuthContext } from "./auth-service.js";
import {
  authorize,
  canAccessVisibility,
  canInvite,
  canManageClub,
  canManageMembershipsOf,
  isFederation,
} from "./authorization.js";

const CLUB_A = "00000000-0000-4000-8000-00000000000a";
const CLUB_B = "00000000-0000-4000-8000-00000000000b";

function ctx(overrides: Partial<AuthContext>): AuthContext {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "x@example.com",
    firstName: null,
    lastName: null,
    accountRole: "user",
    level: "visitor",
    membership: null,
    ...overrides,
  };
}

const membership = (role: "member" | "representative", clubId = CLUB_A) => ({
  id: "00000000-0000-4000-8000-0000000000ff",
  role,
  club: { id: clubId, name: "Club", slug: "club" },
});

const member = ctx({ level: "club_member", membership: membership("member") });
const representative = ctx({
  level: "club_representative",
  membership: membership("representative"),
});
const noClub = ctx({});
const federation = ctx({ accountRole: "federation", level: "federation" });
const federationWithClub = ctx({
  accountRole: "federation",
  level: "federation",
  membership: membership("member", CLUB_B),
});
const admin = ctx({ accountRole: "administrator", level: "administrator" });

describe("club management boundaries (spec §15.1 permission-boundary tests)", () => {
  it("representative can manage own club", () => {
    expect(canManageClub(representative, CLUB_A)).toBe(true);
  });
  it("representative cannot manage another club", () => {
    expect(canManageClub(representative, CLUB_B)).toBe(false);
    expect(canManageMembershipsOf(representative, CLUB_B)).toBe(false);
  });
  it("ordinary member cannot perform representative actions", () => {
    expect(canManageClub(member, CLUB_A)).toBe(false);
    expect(canManageMembershipsOf(member, CLUB_A)).toBe(false);
    expect(canInvite(member, CLUB_A, "member")).toBe(false);
  });
  it("user without membership cannot manage any club", () => {
    expect(canManageClub(noClub, CLUB_A)).toBe(false);
  });
  it("federation and administrators can manage every club", () => {
    for (const c of [federation, federationWithClub, admin]) {
      expect(canManageClub(c, CLUB_A)).toBe(true);
      expect(canManageClub(c, CLUB_B)).toBe(true);
    }
  });
});

describe("invitations", () => {
  it("representative may invite members to own club only", () => {
    expect(canInvite(representative, CLUB_A, "member")).toBe(true);
    expect(canInvite(representative, CLUB_B, "member")).toBe(false);
  });
  it("only federation may invite representatives", () => {
    expect(canInvite(representative, CLUB_A, "representative")).toBe(false);
    expect(canInvite(federation, CLUB_A, "representative")).toBe(true);
    expect(canInvite(admin, CLUB_B, "representative")).toBe(true);
  });
});

describe("federation-only checks", () => {
  it("rejects non-federation users", () => {
    expect(isFederation(representative)).toBe(false);
    expect(isFederation(member)).toBe(false);
    expect(isFederation(federation)).toBe(true);
    expect(isFederation(admin)).toBe(true);
  });
  it("authorize throws 403", () => {
    expect(() => authorize(isFederation(member))).toThrowError(
      expect.objectContaining({ statusCode: 403 }),
    );
  });
});

describe("visibility", () => {
  it("anonymous users only see public content", () => {
    expect(canAccessVisibility(null, "public")).toBe(true);
    expect(canAccessVisibility(null, "club")).toBe(false);
  });
  it("members see club content but not representative content", () => {
    expect(canAccessVisibility(member, "club")).toBe(true);
    expect(canAccessVisibility(member, "club_representative")).toBe(false);
  });
  it("a removed member (no membership) loses club content", () => {
    expect(canAccessVisibility(noClub, "club")).toBe(false);
  });
});
