import { DIRECTUS_ROLE_IDS } from "@bsv-sws/directus";
import { appSettingsUpdateSchema } from "@bsv-sws/validation";
import { describe, expect, it } from "vitest";
import {
  matchesAccountFilter,
  matchesSearch,
  paginate,
  settingsChanges,
  toAccountSummary,
  toAppSettings,
  type UserRow,
} from "./admin-rules.js";

const user = (over: Partial<UserRow> = {}): UserRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  email: "anna.muster@example.com",
  first_name: "Anna",
  last_name: "Muster",
  status: "active",
  role: DIRECTUS_ROLE_IDS.user,
  last_access: null,
  ...over,
});
const club = { id: "00000000-0000-4000-8000-00000000000a", name: "SV Musterstadt" };

describe("admin rules", () => {
  it("derives the level of an account like the session does", () => {
    expect(toAccountSummary(user(), undefined).level).toBe("visitor");
    expect(toAccountSummary(user(), { user: "x", role: "member", club }).level).toBe("club_member");
    expect(toAccountSummary(user(), { user: "x", role: "representative", club })).toMatchObject({
      level: "club_representative",
      club,
      membershipRole: "representative",
    });
    // federation account with a club membership stays federation
    expect(
      toAccountSummary(user({ role: DIRECTUS_ROLE_IDS.federation }), {
        user: "x",
        role: "member",
        club,
      }).level,
    ).toBe("federation");
    // roles not managed by the app (built-in Administrator) → null ("Sonstige")
    expect(toAccountSummary(user({ role: "something-else" }), undefined).level).toBeNull();
  });

  it("filters and searches accounts", () => {
    const withoutClub = toAccountSummary(user(), undefined);
    const rep = toAccountSummary(user({ first_name: "Bernd" }), {
      user: "x",
      role: "representative",
      club,
    });
    expect(matchesAccountFilter(withoutClub, "without_club")).toBe(true);
    expect(matchesAccountFilter(rep, "without_club")).toBe(false);
    expect(matchesAccountFilter(rep, "representatives")).toBe(true);
    expect(matchesAccountFilter(rep, "federation")).toBe(false);
    expect(matchesSearch(withoutClub, "anna muster")).toBe(true);
    expect(matchesSearch(withoutClub, "MUSTER@EXAMPLE")).toBe(true);
    expect(matchesSearch(withoutClub, "bernd")).toBe(false);
    expect(matchesSearch(withoutClub, undefined)).toBe(true);
  });

  it("paginates with at least one page", () => {
    expect(paginate([], 1, 2)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
    expect(paginate([1, 2, 3], 2, 2)).toEqual({ items: [3], page: 2, pageCount: 2, total: 3 });
  });

  it("records only changed settings", () => {
    const before = toAppSettings({
      representative_joined_recipients: ["a@example.com"],
      event_review_recipients: null,
      max_representatives_per_club: null,
      date_updated: null,
    });
    expect(before.eventReviewRecipients).toEqual([]);
    expect(settingsChanges(before, { ...before })).toBeNull();
    expect(settingsChanges(before, { ...before, maxRepresentativesPerClub: 3 })).toEqual({
      before: { maxRepresentativesPerClub: null },
      after: { maxRepresentativesPerClub: 3 },
    });
  });

  it("validates settings input: normalised, deduplicated emails and a positive limit", () => {
    const parsed = appSettingsUpdateSchema.parse({
      representativeJoinedRecipients: [" Vorstand@Example.com", "vorstand@example.com"],
      eventReviewRecipients: [],
      maxRepresentativesPerClub: null,
    });
    expect(parsed.representativeJoinedRecipients).toEqual(["vorstand@example.com"]);
    expect(
      appSettingsUpdateSchema.safeParse({
        representativeJoinedRecipients: ["kein-email"],
        eventReviewRecipients: [],
        maxRepresentativesPerClub: null,
      }).success,
    ).toBe(false);
    expect(
      appSettingsUpdateSchema.safeParse({
        representativeJoinedRecipients: [],
        eventReviewRecipients: [],
        maxRepresentativesPerClub: 0,
      }).success,
    ).toBe(false);
  });
});
