import {
  DIRECTUS_ROLE_IDS,
  DIRECTUS_SERVICE_USER_ID,
  type DirectusUserRecord,
} from "@bsv-sws/directus";
import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "./auth-service.js";
import type { ActiveMembershipRecord, IdentityProvider } from "./identity-provider.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";

function fakeIdentity(opts: {
  valid?: boolean;
  adminAccess?: boolean;
  user?: Partial<DirectusUserRecord> | null;
  membership?: ActiveMembershipRecord | null;
}): IdentityProvider {
  return {
    verifyToken: vi.fn(async (token: string) =>
      opts.valid === false || token !== "good-token"
        ? null
        : { userId: USER_ID, adminAccess: opts.adminAccess ?? false },
    ),
    getUser: vi.fn(async () =>
      opts.user === null
        ? null
        : {
            id: USER_ID,
            email: "user@example.com",
            first_name: "Erika",
            last_name: "Muster",
            status: "active" as const,
            role: DIRECTUS_ROLE_IDS.user,
            phone: null,
            ...opts.user,
          },
    ),
    getActiveMembership: vi.fn(async () => opts.membership ?? null),
  };
}

const repMembership: ActiveMembershipRecord = {
  id: "00000000-0000-4000-8000-0000000000ff",
  role: "representative",
  club: { id: "00000000-0000-4000-8000-00000000000a", name: "SV A", slug: "sv-a" },
};

describe("AuthService.authenticate", () => {
  it("rejects missing or malformed Authorization headers", async () => {
    const auth = createAuthService(fakeIdentity({}));
    await expect(auth.authenticate(undefined)).rejects.toMatchObject({ statusCode: 401 });
    await expect(auth.authenticate("Basic abc")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects tokens Directus does not accept", async () => {
    const auth = createAuthService(fakeIdentity({}));
    await expect(auth.authenticate("Bearer bad-token")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("derives club_representative from the membership, not the Directus role", async () => {
    const auth = createAuthService(fakeIdentity({ membership: repMembership }));
    const ctx = await auth.authenticate("Bearer good-token");
    expect(ctx).toMatchObject({
      accountRole: "user",
      level: "club_representative",
      membership: repMembership,
    });
  });

  it("recognises federation by role id and administrators by admin_access", async () => {
    const fed = await createAuthService(
      fakeIdentity({ user: { role: DIRECTUS_ROLE_IDS.federation } }),
    ).authenticate("Bearer good-token");
    expect(fed.level).toBe("federation");

    const admin = await createAuthService(
      fakeIdentity({ adminAccess: true, user: { role: "some-admin-role" } }),
    ).authenticate("Bearer good-token");
    expect(admin.level).toBe("administrator");
  });

  it("rejects suspended users and unknown roles (e.g. the service account)", async () => {
    await expect(
      createAuthService(fakeIdentity({ user: { status: "suspended" } })).authenticate(
        "Bearer good-token",
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      createAuthService(
        fakeIdentity({
          user: { id: DIRECTUS_SERVICE_USER_ID, role: DIRECTUS_ROLE_IDS.apiService },
        }),
      ).authenticate("Bearer good-token"),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("caches token verification but always reloads role and membership", async () => {
    const identity = fakeIdentity({});
    const auth = createAuthService(identity);
    await auth.authenticate("Bearer good-token");
    await auth.authenticate("Bearer good-token");
    expect(identity.verifyToken).toHaveBeenCalledTimes(1);
    expect(identity.getActiveMembership).toHaveBeenCalledTimes(2);
  });
});
