import { describe, expect, it } from "vitest";
import {
  clubCreateSchema,
  clubRepresentativeFieldsSchema,
  clubUpdateSchema,
  invitationCreateSchema,
  invitationRegisterSchema,
  invitationTokenSchema,
  verificationCodeSchema,
} from "./index.js";

describe("club schemas", () => {
  it("normalises empty form fields to null", () => {
    const parsed = clubRepresentativeFieldsSchema.parse({ website: "", email: " ", phone: "" });
    expect(parsed).toMatchObject({ website: null, email: null, phone: null });
  });

  it("rejects invalid URLs, emails and slugs", () => {
    expect(
      clubRepresentativeFieldsSchema.safeParse({ website: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(clubRepresentativeFieldsSchema.safeParse({ email: "nope" }).success).toBe(false);
    expect(clubCreateSchema.safeParse({ name: "SV A", slug: "SV A", active: true }).success).toBe(
      false,
    );
  });

  it("rejects unknown fields on update", () => {
    expect(clubUpdateSchema.safeParse({ logo: "x" }).success).toBe(false);
  });

  it("representative schema does not contain federation-only fields", () => {
    expect(Object.keys(clubRepresentativeFieldsSchema.shape)).not.toEqual(
      expect.arrayContaining(["name", "slug", "active"]),
    );
  });
});

describe("invitation schemas", () => {
  it("normalises the email and defaults sendEmail", () => {
    expect(invitationCreateSchema.parse({ email: " A@Example.COM ", role: "member" })).toEqual({
      email: "a@example.com",
      role: "member",
      sendEmail: true,
    });
  });

  it("enforces password length and 6-digit codes", () => {
    expect(
      invitationRegisterSchema.safeParse({ firstName: "a", lastName: "b", password: "short" })
        .success,
    ).toBe(false);
    expect(verificationCodeSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(verificationCodeSchema.safeParse({ code: "123456" }).success).toBe(true);
  });

  it("accepts only well-formed tokens", () => {
    expect(invitationTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
    expect(invitationTokenSchema.safeParse("../etc").success).toBe(false);
  });
});

import { eventCreateSchema, eventFieldRules, eventUpdateSchema } from "./index.js";

describe("event schemas", () => {
  const base = {
    title: "Bezirksmeisterschaften",
    startDate: "2026-12-05",
    endDate: "2026-12-06",
    allDay: true,
    calendar: "swimming",
    organizerType: "club",
  };

  it("accepts a minimal event and normalises times", () => {
    const parsed = eventCreateSchema.parse({ ...base, startTime: "09:00:00", endTime: "" });
    expect(parsed).toMatchObject({
      startTime: "09:00",
      endTime: null,
      categoryIds: [],
      schedule: [],
    });
  });

  it("rejects unknown calendars and invalid dates", () => {
    expect(eventCreateSchema.safeParse({ ...base, calendar: "diving" }).success).toBe(false);
    expect(eventCreateSchema.safeParse({ ...base, startDate: "05.12.2026" }).success).toBe(false);
  });

  it("update schema is strict (no status or unknown fields)", () => {
    expect(eventUpdateSchema.safeParse({ status: "published" }).success).toBe(false);
  });

  it("cross-field rules", () => {
    const ok = {
      startDate: "2026-12-05",
      endDate: "2026-12-05",
      allDay: true,
      organizerType: "club" as const,
      clubId: "x",
    };
    expect(eventFieldRules(ok)).toEqual({});
    expect(eventFieldRules({ ...ok, endDate: "2026-12-04" })).toHaveProperty("endDate");
    expect(eventFieldRules({ ...ok, allDay: false })).toHaveProperty("startTime");
    expect(
      eventFieldRules({ ...ok, allDay: false, startTime: "10:00", endTime: "09:00" }),
    ).toHaveProperty("endTime");
    expect(eventFieldRules({ ...ok, organizerType: "external" })).toHaveProperty("organizerName");
    expect(eventFieldRules({ ...ok, clubId: null })).toHaveProperty("organizerType");
  });
});
