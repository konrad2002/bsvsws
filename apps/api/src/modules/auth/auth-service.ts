import { createHash } from "node:crypto";
import { DIRECTUS_ROLE_IDS } from "@bsv-sws/directus";
import { deriveUserLevel, type AccountRole } from "@bsv-sws/shared";
import type { SessionUser } from "@bsv-sws/validation";
import { unauthorized } from "../../lib/errors.js";
import { TtlCache } from "../../lib/ttl-cache.js";
import type { IdentityProvider, VerifiedToken } from "./identity-provider.js";

/** Authorization context of the ORIGINAL user for one request (spec §3.4). */
export type AuthContext = SessionUser;

/** Maps the Directus role to the account role. Unknown roles are not allowed to use the app. */
export function mapAccountRole(roleId: string | null, adminAccess: boolean): AccountRole | null {
  if (adminAccess) return "administrator";
  if (roleId === DIRECTUS_ROLE_IDS.federation) return "federation";
  if (roleId === DIRECTUS_ROLE_IDS.user) return "user";
  return null; // e.g. service account or roles not managed by this application
}

export interface AuthServiceOptions {
  /** How long a successful token verification is cached. Keep short. */
  tokenCacheTtlMs?: number;
}

/**
 * Turns a bearer token into an AuthContext:
 *   1. Directus verifies the token (as the user) → user id + admin flag (cached briefly)
 *   2. Service account loads user, account role and active membership (not cached,
 *      so role/membership changes apply immediately)
 */
export function createAuthService(identity: IdentityProvider, options: AuthServiceOptions = {}) {
  const tokenCache = new TtlCache<VerifiedToken>(options.tokenCacheTtlMs ?? 30_000);

  async function verify(token: string): Promise<VerifiedToken> {
    const key = createHash("sha256").update(token).digest("hex");
    const cached = tokenCache.get(key);
    if (cached) return cached;
    const verified = await identity.verifyToken(token);
    if (!verified) throw unauthorized("Die Sitzung ist ungültig oder abgelaufen.");
    tokenCache.set(key, verified);
    return verified;
  }

  return {
    async authenticate(authorizationHeader: string | undefined): Promise<AuthContext> {
      const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader ?? "");
      if (!match?.[1]) throw unauthorized();

      const { userId, adminAccess } = await verify(match[1]);
      const [user, membership] = await Promise.all([
        identity.getUser(userId),
        identity.getActiveMembership(userId),
      ]);
      if (!user || user.status !== "active" || !user.email) {
        throw unauthorized("Das Benutzerkonto ist nicht aktiv.");
      }
      const accountRole = mapAccountRole(user.role, adminAccess);
      if (!accountRole) throw unauthorized("Dieses Konto darf die Anwendung nicht verwenden.");

      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        accountRole,
        level: deriveUserLevel(accountRole, membership?.role ?? null),
        membership,
      };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
