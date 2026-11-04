/**
 * Phase 3 integration tests against a REAL Directus: event creation, review
 * workflow, locked fields, removal requests, discard, files, notifications.
 * Requires `pnpm directus:apply` + `pnpm directus:seed`. Run: test:integration.
 */
import {
  createDirectus,
  deleteItems,
  readItems,
  readSingleton,
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

describe.skipIf(!enabled)("Phase 3 event workflow (real Directus)", () => {
  const env = enabled ? loadEnv() : (undefined as never);
  const run = randomUUID().slice(0, 8);
  const mailer = createFakeMailer();
  const admin = enabled
    ? createDirectus(env.DIRECTUS_URL)
        .with(staticToken(process.env.DIRECTUS_ADMIN_TOKEN!))
        .with(rest())
    : (undefined as never);
  const reviewer = `review-${run}@example.com`;
  const created: string[] = [];
  const tokens: Record<string, string> = {};
  let app: Awaited<ReturnType<typeof buildApp>>;
  let previousRecipients: string[] | null = null;
  let categoryIds: number[] = [];

  async function login(email: string) {
    const res = await fetch(new URL("/auth/login", env.DIRECTUS_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: process.env.DEV_SEED_PASSWORD }),
    });
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

  const mailTo = (to: string, subject: RegExp) =>
    mailer.sent.find((m) => [m.to].flat().includes(to) && subject.test(m.subject));

  const base = (title: string) => ({
    title: `${title} ${run}`,
    startDate: "2027-03-06",
    endDate: "2027-03-07",
    allDay: false,
    startTime: "09:00",
    endTime: "17:00",
    calendar: "swimming",
    organizerType: "club",
    venue: "Stadtbad Musterstadt",
  });

  async function createEvent(as: string, payload: Record<string, unknown>) {
    const res = await call("POST", "/events", as, payload);
    expect(res.statusCode, res.body).toBe(201);
    created.push(res.json().id);
    return res.json();
  }

  beforeAll(async () => {
    app = await buildApp(env, { logger: false }, { mailer });
    tokens.rep = await login("vertreter@example.com");
    tokens.member = await login("mitglied@example.com");
    tokens.fed = await login("verband@example.com");
    const settings = (await admin.request(readSingleton("notification_settings"))) as {
      event_review_recipients: string[] | null;
    } | null;
    previousRecipients = settings?.event_review_recipients ?? null;
    await admin.request(
      updateSingleton("notification_settings", { event_review_recipients: [reviewer] }),
    );
    categoryIds = ((await call("GET", "/event-categories", "rep")).json() as { id: number }[]).map(
      (c) => c.id,
    );
  });

  afterAll(async () => {
    if (!enabled) return;
    await app?.close();
    await admin.request(
      updateSingleton("notification_settings", { event_review_recipients: previousRecipients }),
    );
    if (created.length) {
      const removals = await admin.request(
        readItems("event_removal_requests", {
          filter: { event: { _in: created } },
          fields: ["id"],
          limit: -1,
        }),
      );
      if (removals.length)
        await admin.request(
          deleteItems(
            "event_removal_requests",
            removals.map((r) => r.id as string),
          ),
        );
      const logs = await admin.request(
        readItems("audit_logs", {
          filter: { entity_type: { _eq: "events" }, entity_id: { _in: created } },
          fields: ["id"],
          limit: -1,
        }),
      );
      if (logs.length)
        await admin.request(
          deleteItems(
            "audit_logs",
            logs.map((l) => l.id as number),
          ),
        );
      await admin.request(deleteItems("events", created));
    }
  });

  it("only representatives and the federation create events; reps cannot set federation fields", async () => {
    expect((await call("POST", "/events", "member", base("X"))).statusCode).toBe(403);
    expect(
      (await call("POST", "/events", "rep", { ...base("X"), official: true })).json().error.code,
    ).toBe("FIELDS_NOT_ALLOWED");
    expect(
      (await call("POST", "/events", "rep", { ...base("X"), endDate: "2027-03-01" })).json().error
        .details.fieldErrors,
    ).toHaveProperty("endDate");
  });

  let ev: { id: string; updatedAt: string };

  it("club creates a draft with schedule and categories; members cannot see it", async () => {
    ev = await createEvent("rep", {
      ...base("Bezirksmeisterschaft"),
      categoryIds: categoryIds.slice(0, 2),
      schedule: [
        { time: "07:30", type: "admission", title: "Einlass" },
        { time: "08:00", type: "warm_up", title: "Einschwimmen" },
        { date: "2027-03-07", time: "09:00", type: "session", title: "2. Abschnitt" },
      ],
    });
    const detail = (await call("GET", `/events/${ev.id}`, "rep")).json();
    expect(detail).toMatchObject({
      status: "draft",
      official: false,
      club: { name: "SV Musterstadt e. V." },
      startTime: "09:00",
    });
    expect(detail.schedule.map((s: { title: string }) => s.title)).toEqual([
      "Einlass",
      "Einschwimmen",
      "2. Abschnitt",
    ]);
    expect(detail.categories).toHaveLength(2);
    expect(detail.allowedActions).toEqual(expect.arrayContaining(["edit", "submit", "discard"]));
    expect((await call("GET", `/events/${ev.id}`, "member")).statusCode).toBe(404);
    expect((await call("GET", `/events/${ev.id}`)).statusCode).toBe(401);
  });

  it("submission notifies review recipients; pending stays editable for the club", async () => {
    const res = await call("POST", `/events/${ev.id}/submit`, "rep");
    expect(res.json().status).toBe("pending");
    expect(mailTo(reviewer, /Neue Veranstaltung zur Prüfung/)).toBeTruthy();
    const stale = res.json().updatedAt;

    await new Promise((r) => setTimeout(r, 1100)); // date_updated has second precision
    const edited = await call("PATCH", `/events/${ev.id}`, "rep", {
      venue: "Neue Halle",
      schedule: [{ time: "08:00", type: "admission", title: "Einlass" }],
    });
    expect(edited.json()).toMatchObject({ status: "pending", venue: "Neue Halle" });
    expect(edited.json().schedule).toHaveLength(1);

    // a representative cannot approve by manipulating the request
    expect(
      (await call("POST", `/events/${ev.id}/approve`, "rep", { version: edited.json().updatedAt }))
        .statusCode,
    ).toBe(409);
    // reviewer looked at the old version → refused
    expect(
      (await call("POST", `/events/${ev.id}/approve`, "fed", { version: stale })).json().error.code,
    ).toBe("EVENT_CHANGED");
    ev = edited.json();
  });

  it("federation approves; submitter is notified; event becomes public", async () => {
    const res = await call("POST", `/events/${ev.id}/approve`, "fed", { version: ev.updatedAt });
    expect(res.json()).toMatchObject({ status: "published" });
    expect(res.json().publishedAt).toBeTruthy();
    expect(mailTo("vertreter@example.com", /Veranstaltung freigegeben/)).toBeTruthy();
    expect((await call("GET", `/events/${ev.id}`, "member")).statusCode).toBe(200);
  });

  it("published: title and dates are locked for the club, times stay editable; federation may override", async () => {
    expect(
      (await call("PATCH", `/events/${ev.id}`, "rep", { title: "Umbenannt" })).json().error.code,
    ).toBe("LOCKED_FIELDS");
    expect(
      (await call("PATCH", `/events/${ev.id}`, "rep", { startDate: "2027-03-05" })).json().error
        .code,
    ).toBe("LOCKED_FIELDS");
    const t = await call("PATCH", `/events/${ev.id}`, "rep", { startTime: "10:00" });
    expect(t.json()).toMatchObject({ status: "published", startTime: "10:00" });
    expect(t.json().lockedFields).toEqual(["title", "startDate", "endDate"]);
    expect(
      (await call("PATCH", `/events/${ev.id}`, "fed", { endDate: "2027-03-08" })).json().endDate,
    ).toBe("2027-03-08");
    expect((await call("GET", `/events/${ev.id}`, "rep")).json().allowedActions).not.toContain(
      "discard",
    );
  });

  it("removal requests keep the event public until the federation decides", async () => {
    const req = await call("POST", `/events/${ev.id}/removal-request`, "rep", {
      type: "delete",
      reason: "Wettkampf abgesagt",
    });
    expect(req.json()).toMatchObject({
      status: "published",
      pendingRemoval: { type: "delete", status: "pending" },
    });
    expect(mailTo(reviewer, /Antrag auf Löschung/)).toBeTruthy();
    expect(
      (
        await call("POST", `/events/${ev.id}/removal-request`, "rep", {
          type: "unpublish",
          reason: "doppelt",
        })
      ).statusCode,
    ).toBe(409);
    expect((await call("GET", `/events/${ev.id}`, "member")).json().status).toBe("published");

    const reject = await call("POST", `/events/${ev.id}/removal-decision`, "fed", {
      approve: false,
      comment: "Bitte nur verschieben",
    });
    expect(reject.json()).toMatchObject({ status: "published", pendingRemoval: null });
    expect(mailTo("vertreter@example.com", /Löschung abgelehnt/)).toBeTruthy();

    await call("POST", `/events/${ev.id}/removal-request`, "rep", {
      type: "unpublish",
      reason: "Termin entfällt",
    });
    const approve = await call("POST", `/events/${ev.id}/removal-decision`, "fed", {
      approve: true,
    });
    expect(approve.json()).toMatchObject({
      status: "unpublished",
      deleted: false,
      pendingRemoval: null,
    });
    expect((await call("GET", `/events/${ev.id}`, "member")).statusCode).toBe(404);
    // unpublished events can be resubmitted
    expect((await call("POST", `/events/${ev.id}/submit`, "rep")).json().status).toBe("pending");
  });

  it("rejection requires a comment, keeps it, and allows resubmission", async () => {
    const e = await createEvent("rep", {
      ...base("Kampfrichterlehrgang"),
      calendar: "general",
      allDay: true,
      startTime: "",
      endTime: "",
    });
    const submitted = (await call("POST", `/events/${e.id}/submit`, "rep")).json();
    expect(
      (await call("POST", `/events/${e.id}/reject`, "fed", { version: submitted.updatedAt }))
        .statusCode,
    ).toBe(400);
    const rejected = await call("POST", `/events/${e.id}/reject`, "fed", {
      version: submitted.updatedAt,
      comment: "Bitte Ort ergänzen",
    });
    expect(rejected.json()).toMatchObject({
      status: "rejected",
      reviewComment: "Bitte Ort ergänzen",
    });
    const mail = mailTo("vertreter@example.com", /Veranstaltung abgelehnt/)!;
    expect(mail.text).toContain("Bitte Ort ergänzen");
    expect((await call("POST", `/events/${e.id}/submit`, "rep")).json().status).toBe("pending");
    expect(mailTo(reviewer, /Erneut eingereicht/)).toBeTruthy();

    const history = (await call("GET", `/events/${e.id}/history`, "rep")).json() as {
      id: unknown;
      action: string;
      comment: string | null;
    }[];
    expect(typeof history[0]!.id).toBe("number"); // bigInteger ids arrive as strings from Directus
    expect(history.map((h) => h.action)).toEqual([
      "event.resubmitted",
      "event.rejected",
      "event.submitted",
      "event.created",
    ]);
    expect(history.find((h) => h.action === "event.rejected")?.comment).toBe("Bitte Ort ergänzen");
  });

  it("club discards never-published drafts; federation creates and publishes official events directly", async () => {
    const draft = await createEvent("rep", base("Entwurf"));
    expect((await call("DELETE", `/events/${draft.id}`, "rep")).statusCode).toBe(204);
    expect((await call("GET", `/events/${draft.id}`, "rep")).statusCode).toBe(404);
    expect((await call("GET", `/events/${draft.id}`, "fed")).json().deleted).toBe(true);
    const archive = (await call("GET", "/events?deleted=true", "fed")).json() as { id: string }[];
    expect(archive.some((x) => x.id === draft.id)).toBe(true);

    const official = await createEvent("fed", {
      ...base("Verbandstag"),
      organizerType: "federation",
      calendar: "general",
      clubId: null,
    });
    expect(official).toMatchObject({ official: true, club: null });
    expect((await call("POST", `/events/${official.id}/publish`, "fed")).json().status).toBe(
      "published",
    );
    expect((await call("DELETE", `/events/${official.id}`, "rep")).statusCode).toBe(403);
  });

  it("files: owners upload; public download only once published", async () => {
    const e = await createEvent("rep", base("Mit Ausschreibung"));
    const boundary = `----e${run}`;
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\nAusschreibung\r\n`,
      ),
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="ausschreibung.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
      ),
      Buffer.from("%PDF-1.4\n%test\n"),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const up = await app.inject({
      method: "POST",
      url: `/events/${e.id}/files`,
      payload: body,
      headers: {
        authorization: `Bearer ${tokens.rep}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
    });
    expect(up.statusCode, up.body).toBe(201);
    const file = up.json().files[0];
    expect(file).toMatchObject({ description: "Ausschreibung", filename: "ausschreibung.pdf" });

    expect((await call("GET", `/events/${e.id}/files/${file.id}`)).statusCode).toBe(404); // draft: not public
    expect((await call("GET", `/events/${e.id}/files/${file.id}`, "rep")).statusCode).toBe(200);
    await call("POST", `/events/${e.id}/publish`, "fed");
    const pub = await call("GET", `/events/${e.id}/files/${file.id}`);
    expect(pub.statusCode).toBe(200);
    expect(pub.headers["content-disposition"]).toContain("attachment");
  });

  it("federation review queue lists pending events and removal requests", async () => {
    const queue = (await call("GET", "/events/review", "fed")).json();
    expect(queue.pendingEvents.some((e: { id: string }) => e.id === ev.id)).toBe(true);
    expect((await call("GET", "/events/review", "rep")).statusCode).toBe(403);
  });
});
