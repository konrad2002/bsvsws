/**
 * The five user levels of spec §4.1, in ascending order of privilege.
 * A user's level is *derived* (see `deriveUserLevel`):
 *   - `visitor`: not authenticated (never persisted)
 *   - `club_member` / `club_representative`: from the active club membership's role
 *   - `federation` / `administrator`: from the Directus account role
 */
export const USER_LEVELS = [
  "visitor",
  "club_member",
  "club_representative",
  "federation",
  "administrator",
] as const;
export type UserLevel = (typeof USER_LEVELS)[number];

export const USER_LEVEL_LABELS: Record<UserLevel, string> = {
  visitor: "Besucher",
  club_member: "Verein",
  club_representative: "Vereinsvertreter",
  federation: "Verband",
  administrator: "Administrator",
};

/**
 * Global account role stored as the Directus role (decision: 3 Directus roles).
 * Club member vs. representative is NOT an account role – it lives on the membership.
 */
export const ACCOUNT_ROLES = ["user", "federation", "administrator"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

/** Role inside a club membership – distinct from global privileges (spec §4.2). */
export const MEMBERSHIP_ROLES = ["member", "representative"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const MEMBERSHIP_ROLE_LABELS: Record<MembershipRole, string> = {
  member: "Mitglied",
  representative: "Vereinsvertreter",
};

/** The four fixed content visibility levels (spec §8.4). Order = ascending privilege. */
export const VISIBILITY_LEVELS = ["public", "club", "club_representative", "federation"] as const;
export type VisibilityLevel = (typeof VISIBILITY_LEVELS)[number];

/** German UI labels for visibility levels. */
export const VISIBILITY_LABELS: Record<VisibilityLevel, string> = {
  public: "Öffentlich",
  club: "Verein",
  club_representative: "Vereinsvertreter",
  federation: "Verband",
};

/**
 * Derives the user level from the account role and the active membership role.
 * Account privileges win; a federation user with a club membership is still `federation`.
 * An authenticated `user` without active membership has no club privileges → `visitor` level.
 */
export function deriveUserLevel(
  accountRole: AccountRole | null,
  membershipRole: MembershipRole | null,
): UserLevel {
  if (accountRole === "administrator") return "administrator";
  if (accountRole === "federation") return "federation";
  if (membershipRole === "representative") return "club_representative";
  if (membershipRole === "member") return "club_member";
  return "visitor";
}

const LEVEL_RANK: Record<UserLevel, number> = {
  visitor: 0,
  club_member: 1,
  club_representative: 2,
  federation: 3,
  administrator: 4,
};

/** Minimum user level required to see content of a visibility level (spec §8.4). */
export const VISIBILITY_MIN_LEVEL: Record<VisibilityLevel, UserLevel> = {
  public: "visitor",
  club: "club_member",
  club_representative: "club_representative",
  federation: "federation",
};

export function hasMinLevel(level: UserLevel, required: UserLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[required];
}

export function canSeeVisibility(level: UserLevel, visibility: VisibilityLevel): boolean {
  return hasMinLevel(level, VISIBILITY_MIN_LEVEL[visibility]);
}
