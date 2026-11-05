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

import { eventFileMetaSchema } from "./index.js";

describe("event schedule (SwimResults model)", () => {
  const base = {
    title: "Bezirksmeisterschaften",
    startDate: "2026-12-05",
    endDate: "2026-12-06",
    allDay: true,
    calendar: "swimming",
    organizerType: "federation",
  };

  it("accepts sections, races and items and drops fields of other kinds", () => {
    const parsed = eventCreateSchema.parse({
      ...base,
      schedule: [
        { kind: "section", number: 1, date: "2026-12-05", time: "09:00", distance: 50 },
        {
          kind: "race",
          number: 1,
          distance: 200,
          relay: "4 × 50",
          stroke: "freestyle",
          gender: "mixed",
          type: "break",
        },
        { kind: "item", type: "break", title: "Pause", time: "11:00", endTime: "11:30", number: 9 },
      ],
    });
    expect(parsed.schedule).toEqual([
      expect.objectContaining({ kind: "section", number: 1, distance: null, type: "custom" }),
      expect.objectContaining({ kind: "race", relay: "4x50", stroke: "freestyle", type: "custom" }),
      expect.objectContaining({ kind: "item", number: null, title: "Pause", endTime: "11:30" }),
    ]);
  });

  it("names the row of an invalid entry", () => {
    const result = eventCreateSchema.safeParse({
      ...base,
      schedule: [
        { kind: "item", title: "Einlass" },
        { kind: "race", number: 2 },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      "Ablauf, Zeile 2: Bitte die Strecke angeben.",
      "Ablauf, Zeile 2: Bitte die Lage angeben.",
    ]);
  });

  it("restricts the SwimResults id to URL-safe characters", () => {
    expect(eventUpdateSchema.parse({ swimresultsId: " IESC26 " }).swimresultsId).toBe("IESC26");
    expect(eventUpdateSchema.parse({ swimresultsId: "" }).swimresultsId).toBeNull();
    expect(eventUpdateSchema.safeParse({ swimresultsId: "../x?y" }).success).toBe(false);
  });
});

describe("event file meta", () => {
  it("requires a description only for other files", () => {
    expect(eventFileMetaSchema.parse({ type: "results_list" })).toMatchObject({
      type: "results_list",
    });
    expect(eventFileMetaSchema.safeParse({ type: "other", description: " " }).success).toBe(false);
    expect(eventFileMetaSchema.parse({ description: "Hallenplan" }).type).toBe("other");
  });
});
