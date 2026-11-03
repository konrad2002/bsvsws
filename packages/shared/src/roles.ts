/**
 * Global user roles (spec §4.1). `visitor` represents unauthenticated access
 * and is not persisted as a Directus role.
 */
export const GLOBAL_ROLES = [
  "visitor",
  "club_member",
  "club_representative",
  "federation",
  "administrator",
] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

/** Role inside a club membership – distinct from global privileges (spec §4.2). */
export const MEMBERSHIP_ROLES = ["member", "representative"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

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
