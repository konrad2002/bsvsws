/**
 * Integration tests against a REAL Directus (spec §15.1): invitations, email
 * verification, memberships, club administration and permission boundaries.
 *
 * Requires: running Directus with `pnpm directus:apply` + `pnpm directus:seed`.
 * Run: pnpm --filter @bsv-sws/api test:integration   (skipped otherwise)
 */
import {
  createDirectus,
  deleteItems,
  deleteUsers,
  readItems,
  readSingleton,
  readUsers,
  rest,
  staticToken,
  updateSingleton,
} from "@directus/sdk";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { createFakeMailer } from "../../src/lib/mailer.js";

const enabled = process.env.INTEGRATION === "1" && !!process.env.DIRECTUS_ADMIN_TOKEN;

describe.skipIf(!enabled)("Phase 2 workflows (real Directus)", () => {
  const env = enabled ? loadEnv() : (undefined as never);
  const run = randomUUID().slice(0, 8);
  const mailer = createFakeMailer();
  const admin = enabled
    ? createDirectus(env.DIRECTUS_URL)
        .with(staticToken(process.env.DIRECTUS_ADMIN_TOKEN!))
        .with(rest())
    : (undefined as never);
  const seedPassword = process.env.DEV_SEED_PASSWORD!;
  const fedRecipient = `fed-${run}@example.com`;
  const newRepEmail = `rep-${run}@example.com`;
  const newMemberEmail = `member-${run}@example.com`;
  const password = `pw-${run}-long-enough`;

  let app: Awaited<ReturnType<typeof buildApp>>;
  let previousRecipients: string[] | null = null;
  let clubId = "";
  const tokens: Record<string, string> = {};

  async function login(email: string, pw: string) {
    const res = await fetch(new URL("/auth/login", env.DIRECTUS_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: pw }),
    });
    expect(res.status, `login ${email}`).toBe(200);
    return ((await res.json()) as { data: { access_token: string } }).data.access_token;
  }

  const call = (
    method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT",
    url: string,
    as?: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      headers: as ? { authorization: `Bearer ${tokens[as]}` } : {},
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });

  const lastMailTo = (to: string) =>
    [...mailer.sent].reverse().find((m) => [m.to].flat().includes(to));
  const tokenFrom = (text: string) => /\/einladung\/([A-Za-z0-9_-]{43})/.exec(text)![1]!;
  const codeFrom = (text: string) => /\b(\d{6})\b/.exec(text)![1]!;

  beforeAll(async () => {
    app = await buildApp(env, { logger: false }, { mailer });
    tokens.fed = await login("verband@example.com", seedPassword);
    tokens.otherRep = await login("vertreter@example.com", seedPassword);
    tokens.otherMember = await login("mitglied@example.com", seedPassword);
    const settings = (await admin.request(readSingleton("notification_settings"))) as {
      representative_joined_recipients: string[] | null;
    } | null;
    previousRecipients = settings?.representative_joined_recipients ?? null;
    await admin.request(
      updateSingleton("notification_settings", {
        representative_joined_recipients: [fedRecipient],
      }),
    );
  });

  afterAll(async () => {
    if (!enabled) return;
    await app?.close();
    await admin.request(
      updateSingleton("notification_settings", {
        representative_joined_recipients: previousRecipients,
      }),
    );
    if (clubId) {
      // Test cleanup only (admin): history collections are append-only for everyone else.
      const ms = await admin.request(
        readItems("club_memberships", {
          filter: { club: { _eq: clubId } },
          fields: ["id"],
          limit: -1,
        }),
      );
      if (ms.length)
        await admin.request(
          deleteItems(
            "club_memberships",
            ms.map((m) => m.id as string),
          ),
        );
      const inv = await admin.request(
        readItems("invitations", { filter: { club: { _eq: clubId } }, fields: ["id"], limit: -1 }),
      );
      if (inv.length)
        await admin.request(
          deleteItems(
            "invitations",
            inv.map((i) => i.id as string),
          ),
        );
      const logs = await admin.request(
        readItems("audit_logs", { filter: { club: { _eq: clubId } }, fields: ["id"], limit: -1 }),
      );
      if (logs.length)
        await admin.request(
          deleteItems(
            "audit_logs",
            logs.map((l) => l.id as number),
          ),
        );
      await admin.request(deleteItems("clubs", [clubId]));
    }
    const users = await admin.request(
      readUsers({ filter: { email: { _in: [newRepEmail, newMemberEmail] } }, fields: ["id"] }),
    );
    if (users.length) await admin.request(deleteUsers(users.map((u) => u.id as string)));
  });

  it("federation creates a club; representatives cannot", async () => {
    const body = { name: `Testverein ${run}`, slug: `testverein-${run}`, active: true };
    expect((await call("POST", "/clubs", "otherRep", body)).statusCode).toBe(403);
    const res = await call("POST", "/clubs", "fed", body);
    expect(res.statusCode).toBe(201);
    clubId = res.json().id;
    expect((await call("POST", "/clubs", "fed", body)).json().error.code).toMatch(
      /NAME_TAKEN|SLUG_TAKEN/,
    );
  });

  it("other clubs' representatives and members are locked out of the new club", async () => {
    expect((await call("GET", `/clubs/${clubId}/members`, "otherRep")).statusCode).toBe(403);
    expect(
      (
        await call("POST", `/clubs/${clubId}/invitations`, "otherRep", {
          email: "x@example.com",
          role: "member",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await call("PATCH", `/clubs/${clubId}`, "otherRep", { website: "https://x.de" })).statusCode,
    ).toBe(403);
    expect((await call("GET", `/clubs/${clubId}/members`, "otherMember")).statusCode).toBe(403);
  });

  it("federation invites the initial representative (email)", async () => {
    const res = await call("POST", `/clubs/${clubId}/invitations`, "fed", {
      email: newRepEmail,
      role: "representative",
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      emailSent: true,
      invitation: { status: "pending", role: "representative" },
    });
    const mail = lastMailTo(newRepEmail)!;
    expect(mail.subject).toContain("Vereinsvertreter");
    expect(tokenFrom(mail.text)).toBe(tokenFrom(res.json().link));
    tokens.repInvite = tokenFrom(mail.text);
    // duplicate open invitation is rejected
    expect(
      (
        await call("POST", `/clubs/${clubId}/invitations`, "fed", {
          email: newRepEmail,
          role: "representative",
        })
      ).json().error.code,
    ).toBe("INVITATION_EXISTS");
  });

  it("new representative registers, verifies with the 6-digit code and joins", async () => {
    const t = tokens.repInvite;
    expect((await call("GET", `/invitations/by-token/${t}`)).json()).toMatchObject({
      status: "valid",
      accountExists: false,
      awaitingVerification: false,
    });

    const reg = await call("POST", `/invitations/by-token/${t}/register`, undefined, {
      firstName: "Rita",
      lastName: "Rep",
      password,
    });
    expect(reg.statusCode).toBe(202);
    expect((await call("GET", `/invitations/by-token/${t}`)).json().awaitingVerification).toBe(
      true,
    );

    // unverified account cannot log in yet
    const early = await fetch(new URL("/auth/login", env.DIRECTUS_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: newRepEmail, password }),
    });
    expect(early.status).toBe(401);

    const code = codeFrom(lastMailTo(newRepEmail)!.subject);
    const wrong = code === "000000" ? "111111" : "000000";
    const bad = await call("POST", `/invitations/by-token/${t}/verify`, undefined, { code: wrong });
    expect(bad.json().error).toMatchObject({
      code: "INVALID_CODE",
      details: { remainingAttempts: 4 },
    });

    const ok = await call("POST", `/invitations/by-token/${t}/verify`, undefined, { code });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ email: newRepEmail });

    // single use
    expect(
      (await call("POST", `/invitations/by-token/${t}/verify`, undefined, { code })).json().error
        .code,
    ).toBe("INVITATION_USED");
    expect((await call("GET", `/invitations/by-token/${t}`)).json().status).toBe("accepted");
    // federation got the "representative joined" notification
    expect(lastMailTo(fedRecipient)?.subject).toContain("Neuer Vereinsvertreter");

    tokens.newRep = await login(newRepEmail, password);
    expect((await call("GET", "/me", "newRep")).json()).toMatchObject({
      level: "club_representative",
      membership: { role: "representative", club: { id: clubId } },
    });
  });

  it("representative invites a member via manual link; cannot invite representatives", async () => {
    expect(
      (
        await call("POST", `/clubs/${clubId}/invitations`, "newRep", {
          email: "r2@example.com",
          role: "representative",
        })
      ).statusCode,
    ).toBe(403);
    const before = mailer.sent.length;
    const res = await call("POST", `/clubs/${clubId}/invitations`, "newRep", {
      email: newMemberEmail,
      role: "member",
      sendEmail: false,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().emailSent).toBe(false);
    expect(mailer.sent.length).toBe(before);
    tokens.memberInvite = tokenFrom(res.json().link);
  });

  it("member registers + verifies; representatives are notified", async () => {
    const t = tokens.memberInvite;
    await call("POST", `/invitations/by-token/${t}/register`, undefined, {
      firstName: "Max",
      lastName: "Member",
      password,
      phone: "0371 1",
    });
    // resend issues a new code; the old one stops working
    const oldCode = codeFrom(lastMailTo(newMemberEmail)!.subject);
    expect((await call("POST", `/invitations/by-token/${t}/resend-code`)).statusCode).toBe(202);
    const newCode = codeFrom(lastMailTo(newMemberEmail)!.subject);
    if (oldCode !== newCode) {
      expect(
        (
          await call("POST", `/invitations/by-token/${t}/verify`, undefined, { code: oldCode })
        ).json().error.code,
      ).toBe("INVALID_CODE");
    }
    expect(
      (await call("POST", `/invitations/by-token/${t}/verify`, undefined, { code: newCode }))
        .statusCode,
    ).toBe(200);
    expect(lastMailTo(newRepEmail)?.subject).toContain("Neues Mitglied");
    tokens.newMember = await login(newMemberEmail, password);
  });

  it("promotion, demotion and the self-change rule", async () => {
    const members = (await call("GET", `/clubs/${clubId}/members`, "newRep")).json() as {
      membershipId: string;
      email: string;
    }[];
    const member = members.find((m) => m.email === newMemberEmail)!;
    const self = members.find((m) => m.email === newRepEmail)!;
    // ordinary members cannot manage
    expect(
      (await call("PATCH", `/memberships/${self.membershipId}`, "newMember", { role: "member" }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await call("PATCH", `/memberships/${member.membershipId}`, "newRep", {
          role: "representative",
        })
      ).json().role,
    ).toBe("representative");
    expect(
      (
        await call("PATCH", `/memberships/${member.membershipId}`, "newRep", { role: "member" })
      ).json().role,
    ).toBe("member");
    expect(
      (
        await call("PATCH", `/memberships/${self.membershipId}`, "newRep", { role: "member" })
      ).json().error.code,
    ).toBe("SELF_CHANGE_NOT_ALLOWED");
    expect(
      (await call("DELETE", `/memberships/${self.membershipId}`, "newRep")).json().error.code,
    ).toBe("SELF_CHANGE_NOT_ALLOWED");
    tokens.memberMembershipId = member.membershipId;
  });

  it("representative edits permitted club fields only; logo upload is served publicly", async () => {
    expect(
      (
        await call("PATCH", `/clubs/${clubId}`, "newRep", {
          website: "https://testverein.de",
          sports: ["swimming"],
        })
      ).json(),
    ).toMatchObject({ website: "https://testverein.de" });
    expect(
      (await call("PATCH", `/clubs/${clubId}`, "newRep", { name: "Umbenannt" })).json().error.code,
    ).toBe("FIELDS_NOT_ALLOWED");

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const boundary = `----b${run}`;
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="logo.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const up = await app.inject({
      method: "PUT",
      url: `/clubs/${clubId}/logo`,
      payload: body,
      headers: {
        authorization: `Bearer ${tokens.newRep}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
    });
    expect(up.statusCode).toBe(200);
    expect(up.json().logo).toBeTruthy();
    const logo = await call("GET", `/clubs/${clubId}/logo`);
    expect(logo.statusCode).toBe(200);
    expect(logo.headers["content-type"]).toContain("image/png");
  });

  it("a user with an active membership cannot accept a second club invitation", async () => {
    const res = await call("POST", `/clubs/${clubId}/invitations`, "fed", {
      email: "mitglied@example.com",
      role: "member",
      sendEmail: false,
    });
    const t = tokenFrom(res.json().link);
    expect((await call("GET", `/invitations/by-token/${t}`)).json().accountExists).toBe(true);
    expect(
      (
        await call("POST", `/invitations/by-token/${t}/register`, undefined, {
          firstName: "a",
          lastName: "b",
          password,
        })
      ).json().error.code,
    ).toBe("ACCOUNT_EXISTS");
    expect(
      (await call("POST", `/invitations/by-token/${t}/accept`, "otherMember")).json().error.code,
    ).toBe("ALREADY_MEMBER");
    // someone else cannot use it
    expect(
      (await call("POST", `/invitations/by-token/${t}/accept`, "newMember")).json().error.code,
    ).toBe("EMAIL_MISMATCH");
    // revoke → link dead
    expect(
      (await call("POST", `/invitations/${res.json().invitation.id}/revoke`, "fed")).json().status,
    ).toBe("revoked");
    expect((await call("GET", `/invitations/by-token/${t}`)).json().status).toBe("revoked");
  });

  it("removed users keep their account, lose club access and can join again by invitation", async () => {
    expect(
      (await call("DELETE", `/memberships/${tokens.memberMembershipId}`, "newRep")).statusCode,
    ).toBe(204);
    expect((await call("GET", "/me", "newMember")).json()).toMatchObject({
      level: "visitor",
      membership: null,
    });

    const res = await call("POST", `/clubs/${clubId}/invitations`, "newRep", {
      email: newMemberEmail,
      role: "member",
      sendEmail: false,
    });
    expect(
      (
        await call(
          "POST",
          `/invitations/by-token/${tokenFrom(res.json().link)}/accept`,
          "newMember",
        )
      ).statusCode,
    ).toBe(204);
    expect((await call("GET", "/me", "newMember")).json().level).toBe("club_member");
  });

  it("important actions are in the audit log with the original user as actor", async () => {
    const logs = (await admin.request(
      readItems("audit_logs", {
        filter: { club: { _eq: clubId } },
        fields: ["action", "actor"],
        limit: -1,
      }),
    )) as { action: string; actor: string | null }[];
    const actions = new Set(logs.map((l) => l.action));
    for (const a of [
      "club.created",
      "club.updated",
      "club.logo_changed",
      "invitation.created",
      "invitation.accepted",
      "invitation.revoked",
      "user.verified",
      "membership.created",
      "membership.promoted",
      "membership.demoted",
      "membership.removed",
    ]) {
      expect(actions, a).toContain(a);
    }
    expect(logs.every((l) => l.actor !== "ddfc5c33-37d9-4ba7-9daf-277f3c0e9f5c")).toBe(true);
  });
});
