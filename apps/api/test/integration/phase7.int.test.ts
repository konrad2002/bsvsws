/**
 * Phase 7 integration tests against a REAL Directus: federation settings,
 * representative limit, account overview and audit log – incl. permission
 * boundaries. Requires apply + seed. Run: test:integration (files run serially:
 * this file changes global settings and restores them afterwards).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { createFakeMailer } from "../../src/lib/mailer.js";

const enabled = process.env.INTEGRATION === "1" && !!process.env.DIRECTUS_ADMIN_TOKEN;

describe.skipIf(!enabled)("Phase 7 federation administration (real Directus)", () => {
  const env = enabled ? loadEnv() : (undefined as never);
  const tokens: Record<string, string> = {};
  let app: Awaited<ReturnType<typeof buildApp>>;
  let original: Record<string, unknown>;

  async function login(email: string) {
    const res = await fetch(new URL("/auth/login", env.DIRECTUS_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: process.env.DEV_SEED_PASSWORD }),
    });
    return ((await res.json()) as { data: { access_token: string } }).data.access_token;
  }
  const call = (method: "GET" | "PUT" | "PATCH", url: string, as?: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      headers: as ? { authorization: `Bearer ${tokens[as]}` } : {},
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  const putSettings = (as: string, over: Record<string, unknown>) =>
    call("PUT", "/admin/settings", as, {
      representativeJoinedRecipients: original.representativeJoinedRecipients,
      eventReviewRecipients: original.eventReviewRecipients,
      maxRepresentativesPerClub: original.maxRepresentativesPerClub,
      ...over,
    });

  beforeAll(async () => {
    app = await buildApp(env, { logger: false }, { mailer: createFakeMailer() });
    tokens.member = await login("mitglied@example.com");
    tokens.rep = await login("vertreter@example.com");
    tokens.fed = await login("verband@example.com");
    original = (await call("GET", "/admin/settings", "fed")).json();
  });

  afterAll(async () => {
    if (!enabled) return;
    await putSettings("fed", {});
    await app?.close();
  });

  it("only the federation reads and changes settings; receiving emails grants nothing", async () => {
    expect((await call("GET", "/admin/settings")).statusCode).toBe(401);
    expect((await call("GET", "/admin/settings", "rep")).statusCode).toBe(403);
    expect((await call("GET", "/admin/settings", "member")).statusCode).toBe(403);
    // the representative is a configured recipient → still no access (spec §10.3)
    expect(
      (await putSettings("fed", { eventReviewRecipients: ["vertreter@example.com"] })).statusCode,
    ).toBe(200);
    expect((await call("GET", "/admin/settings", "rep")).statusCode).toBe(403);
    expect((await call("GET", "/events/review", "rep")).statusCode).toBe(403);
    expect((await putSettings("rep", {})).statusCode).toBe(403);
  });

  it("validates, normalises and audits setting changes", async () => {
    expect(
      (await putSettings("fed", { eventReviewRecipients: ["keine-adresse"] })).statusCode,
    ).toBe(400);
    expect((await putSettings("fed", { maxRepresentativesPerClub: 0 })).statusCode).toBe(400);
    const res = await putSettings("fed", {
      eventReviewRecipients: [" Pruefung@Example.com ", "pruefung@example.com"],
    });
    expect(res.json()).toMatchObject({ eventReviewRecipients: ["pruefung@example.com"] });
    const log = (await call("GET", "/admin/audit-log?action=settings", "fed")).json();
    expect(log.items[0]).toMatchObject({
      action: "settings.updated",
      actor: { name: expect.any(String) },
      changes: { after: { eventReviewRecipients: ["pruefung@example.com"] } },
    });
  });

  it("enforces the representative limit for representatives; the federation overrides", async () => {
    const me = (await call("GET", "/me", "rep")).json();
    const members = (
      await call("GET", `/clubs/${me.membership.club.id}/members`, "rep")
    ).json() as {
      membershipId: string;
      email: string;
      role: string;
    }[];
    const target = members.find((m) => m.email === "mitglied@example.com")!;
    const reps = members.filter((m) => m.role === "representative").length;
    expect((await putSettings("fed", { maxRepresentativesPerClub: reps })).statusCode).toBe(200);

    const promote = (as: string) =>
      call("PATCH", `/memberships/${target.membershipId}`, as, { role: "representative" });
    const blocked = await promote("rep");
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe("REPRESENTATIVE_LIMIT_REACHED");

    expect((await promote("fed")).statusCode).toBe(200);
    const demote = await call("PATCH", `/memberships/${target.membershipId}`, "fed", {
      role: "member",
    });
    expect(demote.statusCode).toBe(200);

    expect((await putSettings("fed", { maxRepresentativesPerClub: null })).statusCode).toBe(200);
    expect((await promote("rep")).statusCode).toBe(200);
    await call("PATCH", `/memberships/${target.membershipId}`, "fed", { role: "member" });
  });

  it("lists accounts with level and club for the federation only", async () => {
    expect((await call("GET", "/admin/accounts", "rep")).statusCode).toBe(403);
    const found = (await call("GET", "/admin/accounts?q=mitglied%40example.com", "fed")).json();
    expect(found.items).toEqual([
      expect.objectContaining({
        email: "mitglied@example.com",
        level: "club_member",
        membershipRole: "member",
        club: expect.objectContaining({ name: expect.any(String) }),
      }),
    ]);
    const fed = (await call("GET", "/admin/accounts?filter=federation", "fed")).json();
    expect(fed.items.some((a: { email: string }) => a.email === "verband@example.com")).toBe(true);
    expect(fed.items.every((a: { level: string }) => a.level === "federation")).toBe(true);
    const all = (await call("GET", "/admin/accounts", "fed")).json();
    // the service account is never listed
    expect(all.items.some((a: { email: string }) => a.email === "api-service@bsv-sws.de")).toBe(
      false,
    );
    expect((await call("GET", "/admin/accounts?filter=nope", "fed")).statusCode).toBe(400);
  });

  it("shows the audit log to the federation only, filtered by action group and club", async () => {
    expect((await call("GET", "/admin/audit-log", "rep")).statusCode).toBe(403);
    const memberships = (await call("GET", "/admin/audit-log?action=membership", "fed")).json();
    expect(memberships.total).toBeGreaterThan(0);
    expect(
      memberships.items.every((e: { action: string }) => e.action.startsWith("membership.")),
    ).toBe(true);
    const promoted = (
      await call("GET", "/admin/audit-log?action=membership.promoted", "fed")
    ).json();
    expect(promoted.items[0]).toMatchObject({
      action: "membership.promoted",
      club: { name: expect.any(String) },
    });
    const clubId = promoted.items[0].club.id;
    const byClub = (await call("GET", `/admin/audit-log?club=${clubId}`, "fed")).json();
    expect(byClub.items.every((e: { club: { id: string } | null }) => e.club?.id === clubId)).toBe(
      true,
    );
    expect((await call("GET", "/admin/audit-log?action=DROP%20TABLE", "fed")).statusCode).toBe(400);
  });
});
