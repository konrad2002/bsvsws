import { DIRECTUS_ROLE_IDS } from "@bsv-sws/directus";
import { deriveUserLevel, type MembershipRole } from "@bsv-sws/shared";
import type { AccountFilter, AccountSummary, AppSettings } from "@bsv-sws/validation";

/** Pure helpers of the federation administration (Phase 7). */

export const ADMIN_PAGE_SIZE = 50;

export interface SettingsRow {
  representative_joined_recipients: string[] | null;
  event_review_recipients: string[] | null;
  max_representatives_per_club: number | null;
  date_updated: string | null;
}

export function toAppSettings(row: SettingsRow | null): AppSettings {
  return {
    representativeJoinedRecipients: row?.representative_joined_recipients?.filter(Boolean) ?? [],
    eventReviewRecipients: row?.event_review_recipients?.filter(Boolean) ?? [],
    maxRepresentativesPerClub: row?.max_representatives_per_club ?? null,
    updatedAt: row?.date_updated ?? null,
  };
}

/** Before/after of the changed settings only (audit log). Null = nothing changed. */
export function settingsChanges(
  before: AppSettings,
  after: Omit<AppSettings, "updatedAt">,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const keys = [
    "representativeJoinedRecipients",
    "eventReviewRecipients",
    "maxRepresentativesPerClub",
  ] as const;
  const changed = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  if (changed.length === 0) return null;
  return {
    before: Object.fromEntries(changed.map((k) => [k, before[k]])),
    after: Object.fromEntries(changed.map((k) => [k, after[k]])),
  };
}

export interface UserRow {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  status: AccountSummary["status"];
  role: string | null;
  last_access: string | null;
}

export interface ActiveMembershipRow {
  user: string;
  role: MembershipRole;
  club: { id: string; name: string };
}

/**
 * Level as the session would derive it. Administrators use the built-in role, which has
 * no fixed id (and the service account cannot read roles) → null, shown as "Sonstige".
 */
export function accountLevel(user: UserRow, membership: ActiveMembershipRow | undefined) {
  if (user.role === DIRECTUS_ROLE_IDS.federation) return deriveUserLevel("federation", null);
  if (user.role === DIRECTUS_ROLE_IDS.user)
    return deriveUserLevel("user", membership?.role ?? null);
  return null;
}

export function toAccountSummary(
  user: UserRow,
  membership: ActiveMembershipRow | undefined,
): AccountSummary {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    status: user.status,
    level: accountLevel(user, membership),
    club: membership ? { id: membership.club.id, name: membership.club.name } : null,
    membershipRole: membership?.role ?? null,
    lastAccess: user.last_access,
  };
}

export function matchesAccountFilter(account: AccountSummary, filter: AccountFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "without_club":
      return account.level === "visitor";
    case "representatives":
      return account.membershipRole === "representative";
    case "federation":
      return account.level === "federation";
  }
}

/** Case-insensitive search in name and email. */
export function matchesSearch(account: AccountSummary, q: string | undefined): boolean {
  if (!q) return true;
  const hay =
    `${account.firstName ?? ""} ${account.lastName ?? ""} ${account.email ?? ""}`.toLocaleLowerCase(
      "de",
    );
  return q
    .toLocaleLowerCase("de")
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

export const byName = (a: AccountSummary, b: AccountSummary) =>
  `${a.lastName ?? ""} ${a.firstName ?? ""} ${a.email ?? ""}`.localeCompare(
    `${b.lastName ?? ""} ${b.firstName ?? ""} ${b.email ?? ""}`,
    "de",
  );

export function paginate<T>(items: T[], page: number, pageSize = ADMIN_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
    total: items.length,
  };
}

export function displayName(u: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}) {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "Unbekannt";
}
