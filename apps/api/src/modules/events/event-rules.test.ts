import { EVENT_STATUSES, type EventStatus } from "@bsv-sws/shared";
import { describe, expect, it } from "vitest";
import type { AuthContext } from "../auth/auth-service.js";
import {
  allowedActions,
  assertAction,
  assertFieldPermissions,
  assertNoLockedChanges,
  assertVersion,
  canViewEvent,
  lockedFields,
  type EventState,
} from "./event-rules.js";

const CLUB_A = "00000000-0000-4000-8000-00000000000a";
const CLUB_B = "00000000-0000-4000-8000-00000000000b";

const user = (over: Partial<AuthContext>): AuthContext => ({
  id: "00000000-0000-4000-8000-000000000001",
  email: "x@example.com",
  firstName: null,
  lastName: null,
  accountRole: "user",
  level: "visitor",
  membership: null,
  ...over,
});
const membership = (role: "member" | "representative", club = CLUB_A) => ({
  id: "00000000-0000-4000-8000-0000000000ff",
  role,
  club: { id: club, name: "C", slug: "c" },
});
const rep = user({ level: "club_representative", membership: membership("representative") });
const otherRep = user({
  level: "club_representative",
  membership: membership("representative", CLUB_B),
});
const member = user({ level: "club_member", membership: membership("member") });
const fed = user({ accountRole: "federation", level: "federation" });

const ev = (status: EventStatus, over: Partial<EventState> = {}): EventState => ({
  status,
  clubId: CLUB_A,
  deleted: false,
  publishedAt: status === "published" || status === "unpublished" ? "2026-11-01T00:00:00Z" : null,
  hasPendingRemoval: false,
  ...over,
});

describe("status transitions (spec §7.7)", () => {
  it("club submits drafts, resubmits rejected and unpublished events", () => {
    for (const s of ["draft", "rejected", "unpublished"] as const) {
      expect(allowedActions(rep, ev(s))).toContain("submit");
    }
    for (const s of ["pending", "published"] as const) {
      expect(allowedActions(rep, ev(s))).not.toContain("submit");
    }
  });

  it("only the federation approves, rejects, publishes and unpublishes", () => {
    expect(allowedActions(fed, ev("pending"))).toEqual(
      expect.arrayContaining(["approve", "reject"]),
    );
    expect(allowedActions(fed, ev("draft"))).toContain("publish");
    expect(allowedActions(fed, ev("published"))).toContain("unpublish");
    for (const s of EVENT_STATUSES) {
      const actions = allowedActions(rep, ev(s));
      for (const a of ["approve", "reject", "publish", "unpublish", "delete"] as const) {
        expect(actions, `${s}/${a}`).not.toContain(a);
      }
    }
  });

  it("a representative cannot approve their own event by manipulating a request", () => {
    expect(() => assertAction(rep, ev("pending"), "approve")).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
    expect(() => assertAction(otherRep, ev("pending"), "approve")).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("wrong status → 409, no role → 403", () => {
    expect(() => assertAction(fed, ev("draft"), "approve")).toThrow(
      expect.objectContaining({ code: "INVALID_STATUS" }),
    );
    expect(() => assertAction(member, ev("draft"), "submit")).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("deleted events allow nothing", () => {
    expect(allowedActions(fed, ev("draft", { deleted: true }))).toEqual([]);
  });
});

describe("removal (spec §7.10, owner decisions)", () => {
  it("owner requests removal only for published events without an open request", () => {
    expect(allowedActions(rep, ev("published"))).toContain("requestRemoval");
    expect(allowedActions(rep, ev("published", { hasPendingRemoval: true }))).not.toContain(
      "requestRemoval",
    );
    expect(allowedActions(rep, ev("draft"))).not.toContain("requestRemoval");
    expect(allowedActions(otherRep, ev("published"))).not.toContain("requestRemoval");
  });

  it("published events stay editable while a removal is pending; federation decides", () => {
    const e = ev("published", { hasPendingRemoval: true });
    expect(allowedActions(rep, e)).toContain("edit");
    expect(allowedActions(fed, e)).toContain("decideRemoval");
    expect(allowedActions(rep, e)).not.toContain("decideRemoval");
  });

  it("only never-published drafts/rejected events can be discarded by the club", () => {
    expect(allowedActions(rep, ev("draft"))).toContain("discard");
    expect(allowedActions(rep, ev("rejected"))).toContain("discard");
    expect(allowedActions(rep, ev("rejected", { publishedAt: "2026-01-01" }))).not.toContain(
      "discard",
    );
    expect(allowedActions(rep, ev("published"))).not.toContain("discard");
  });
});

describe("visibility (spec §7.11)", () => {
  const anon = null;
  it.each([
    ["draft", false, false, true, true],
    ["pending", false, false, true, true],
    ["published", true, true, true, true],
    ["rejected", false, false, true, true],
    ["unpublished", false, false, true, true],
  ] as const)(
    "%s: visitor=%s member=%s owner=%s federation=%s",
    (status, visitor, mem, owner, federation) => {
      const e = ev(status);
      expect(canViewEvent(anon, e)).toBe(visitor);
      expect(canViewEvent(member, e)).toBe(mem);
      expect(canViewEvent(rep, e)).toBe(owner);
      expect(canViewEvent(fed, e)).toBe(federation);
      expect(canViewEvent(otherRep, e)).toBe(visitor);
    },
  );

  it("deleted events are only visible to the federation", () => {
    expect(canViewEvent(rep, ev("published", { deleted: true }))).toBe(false);
    expect(canViewEvent(fed, ev("published", { deleted: true }))).toBe(true);
  });
});

describe("locked fields after publication (spec §7.9)", () => {
  const current = { title: "BM", startDate: "2026-12-05", endDate: "2026-12-06" };

  it("representative cannot change title or dates of a published event", () => {
    for (const input of [
      { title: "Neu" },
      { startDate: "2026-12-04" },
      { endDate: "2026-12-07" },
    ]) {
      expect(() => assertNoLockedChanges(rep, ev("published"), current, input)).toThrow(
        expect.objectContaining({ code: "LOCKED_FIELDS" }),
      );
    }
  });

  it("times and other fields stay editable; unchanged values are accepted", () => {
    expect(() =>
      assertNoLockedChanges(rep, ev("published"), current, {
        startTime: "10:00",
        venue: "Halle",
        title: "BM",
      }),
    ).not.toThrow();
  });

  it("dates are editable before publication and for the federation", () => {
    expect(() =>
      assertNoLockedChanges(rep, ev("pending"), current, { startDate: "2026-12-01" }),
    ).not.toThrow();
    expect(() =>
      assertNoLockedChanges(fed, ev("published"), current, { title: "X" }),
    ).not.toThrow();
    expect(lockedFields(rep, ev("published"))).toEqual(["title", "startDate", "endDate"]);
    expect(lockedFields(fed, ev("published"))).toEqual([]);
  });
});

describe("federation-only fields", () => {
  it("representatives cannot set official, the owning club or BSV-SWS as organizer", () => {
    for (const input of [
      { official: true },
      { clubId: CLUB_B },
      { organizerType: "federation" as const },
    ]) {
      expect(() => assertFieldPermissions(rep, input)).toThrow(
        expect.objectContaining({ code: "FIELDS_NOT_ALLOWED" }),
      );
    }
    expect(() => assertFieldPermissions(fed, { official: true, clubId: null })).not.toThrow();
  });
});

describe("review concurrency", () => {
  it("rejects decisions on a changed version", () => {
    expect(() => assertVersion("2026-11-04T10:00:00.000Z", "2026-11-04T10:00:00Z")).not.toThrow();
    expect(() => assertVersion("2026-11-04T10:05:00Z", "2026-11-04T10:00:00Z")).toThrow(
      expect.objectContaining({ code: "EVENT_CHANGED" }),
    );
  });
});
