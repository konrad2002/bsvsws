import { describe, expect, it } from "vitest";
import {
  assertInvitationUsable,
  emailsMatch,
  invitationDisplayStatus,
  inviteLink,
} from "./invitation-rules.js";

const now = new Date("2026-11-03T12:00:00Z");
const future = "2026-11-10T12:00:00Z";
const past = "2026-11-01T12:00:00Z";

describe("invitation status", () => {
  it("derives expired from pending + past expiry", () => {
    expect(invitationDisplayStatus({ status: "pending", expires_at: future }, now)).toBe("pending");
    expect(invitationDisplayStatus({ status: "pending", expires_at: past }, now)).toBe("expired");
    expect(invitationDisplayStatus({ status: "accepted", expires_at: past }, now)).toBe("accepted");
  });

  it("only pending, unexpired invitations are usable (single use)", () => {
    expect(() =>
      assertInvitationUsable({ status: "pending", expires_at: future }, now),
    ).not.toThrow();
    expect(() => assertInvitationUsable({ status: "pending", expires_at: past }, now)).toThrow(
      expect.objectContaining({ code: "INVITATION_EXPIRED" }),
    );
    expect(() => assertInvitationUsable({ status: "accepted", expires_at: future }, now)).toThrow(
      expect.objectContaining({ code: "INVITATION_USED" }),
    );
    expect(() => assertInvitationUsable({ status: "revoked", expires_at: future }, now)).toThrow(
      expect.objectContaining({ code: "INVITATION_REVOKED" }),
    );
  });

  it("compares emails case-insensitively", () => {
    expect(emailsMatch("A@Example.com ", "a@example.com")).toBe(true);
    expect(emailsMatch("a@example.com", "b@example.com")).toBe(false);
    expect(emailsMatch(null, "a@example.com")).toBe(false);
  });

  it("builds invitation links", () => {
    expect(inviteLink("https://bsv-sws.de", "abc")).toBe("https://bsv-sws.de/einladung/abc");
  });
});
