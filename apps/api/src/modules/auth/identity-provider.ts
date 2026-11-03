import {
  createDirectus,
  readItems,
  readMe,
  readPolicyGlobals,
  readUser,
  rest,
  staticToken,
} from "@directus/sdk";
import { createTokenClient, type DirectusUserRecord } from "@bsv-sws/directus";
import type { MembershipRole } from "@bsv-sws/shared";

/** Result of verifying a user's Directus access token. */
export interface VerifiedToken {
  userId: string;
  /** From GET /policies/me/globals – how administrators are recognised. */
  adminAccess: boolean;
}

export interface ActiveMembershipRecord {
  id: string;
  role: MembershipRole;
  club: { id: string; name: string; slug: string };
}

/**
 * Port to Directus for identity data. Implemented against the real Directus
 * below; tests substitute a fake.
 */
export interface IdentityProvider {
  /** Verifies the token with Directus. Returns null if invalid/expired. */
  verifyToken(accessToken: string): Promise<VerifiedToken | null>;
  /** Loads the user via the service account. */
  getUser(userId: string): Promise<DirectusUserRecord | null>;
  /** Loads the active club membership via the service account. */
  getActiveMembership(userId: string): Promise<ActiveMembershipRecord | null>;
}

export function createDirectusIdentityProvider(
  directusUrl: string,
  serviceToken: string,
): IdentityProvider {
  const service = createTokenClient(directusUrl, serviceToken);

  return {
    async verifyToken(accessToken) {
      // Calls are made AS the user: Directus validates signature, expiry and session.
      // /users/me returns the id even when the user has no Directus permissions.
      const asUser = createDirectus(directusUrl).with(staticToken(accessToken)).with(rest());
      try {
        const [me, globals] = await Promise.all([
          asUser.request(readMe({ fields: ["id"] })),
          asUser.request(readPolicyGlobals()),
        ]);
        if (!me?.id) return null;
        return { userId: me.id, adminAccess: Boolean(globals?.admin_access) };
      } catch (error) {
        if (isAuthError(error)) return null;
        throw error;
      }
    },

    async getUser(userId) {
      try {
        return (await service.request(
          readUser(userId, {
            fields: ["id", "email", "first_name", "last_name", "status", "role", "phone"],
          }),
        )) as DirectusUserRecord;
      } catch (error) {
        if (isAuthError(error)) return null;
        throw error;
      }
    },

    async getActiveMembership(userId) {
      const rows = await service.request(
        readItems("club_memberships", {
          filter: { active_user: { _eq: userId }, status: { _eq: "active" } },
          fields: ["id", "role", { club: ["id", "name", "slug"] }],
          limit: 1,
        }),
      );
      const row = rows[0] as unknown as ActiveMembershipRecord | undefined;
      return row ?? null;
    },
  };
}

function isAuthError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
}
