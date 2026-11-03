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
