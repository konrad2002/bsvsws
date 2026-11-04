/**
 * Phase 4 integration tests against a REAL Directus: public event list/detail,
 * filters, slugs and WebCal feeds. Requires apply + seed. Run: test:integration.
 */
import { createDirectus, deleteItems, readItems, rest, staticToken } from "@directus/sdk";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { createFakeMailer } from "../../src/lib/mailer.js";

const enabled = process.env.INTEGRATION === "1" && !!process.env.DIRECTUS_ADMIN_TOKEN;

describe.skipIf(!enabled)("Phase 4 public calendar (real Directus)", () => {
  const env = enabled ? loadEnv() : (undefined as never);
  const run = randomUUID().slice(0, 8);
  const admin = enabled
    ? createDirectus(env.DIRECTUS_URL)
        .with(staticToken(process.env.DIRECTUS_ADMIN_TOKEN!))
        .with(rest())
    : (undefined as never);
  const tokens: Record<string, string> = {};
  const created: string[] = [];
  const ids: Record<string, string> = {};
  let app: Awaited<ReturnType<typeof buildApp>>;

  async function login(email: string) {
    const res = await fetch(new URL("/auth/login", env.DIRECTUS_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: process.env.DEV_SEED_PASSWORD }),
    });
    return ((await res.json()) as { data: { access_token: string } }).data.access_token;
  }
  const call = (
    method: "GET" | "POST" | "PATCH" | "DELETE",
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

  async function create(as: string, title: string, extra: Record<string, unknown> = {}) {
    const res = await call("POST", "/events", as, {
      title: `${title} ${run}`,
      startDate: "2027-06-12",
      endDate: "2027-06-12",
      allDay: false,
      startTime: "10:00",
      endTime: "16:00",
      calendar: "swimming",
      organizerType: as === "fed" ? "federation" : "club",
      venue: "Stadtbad",
      city: "Musterstadt",
      ...extra,
    });
    expect(res.statusCode, res.body).toBe(201);
    created.push(res.json().id);
    return res.json().id as string;
  }
  const publish = (id: string) => call("POST", `/events/${id}/publish`, "fed");
  const range = "from=2027-06-01&to=2027-06-30";
  const titles = (list: { title: string }[]) => list.map((e) => e.title.replace(` ${run}`, ""));

  beforeAll(async () => {
    app = await buildApp(env, { logger: false }, { mailer: createFakeMailer() });
    tokens.rep = await login("vertreter@example.com");
    tokens.fed = await login("verband@example.com");
    const categories = (await call("GET", "/event-categories", "rep")).json() as {
      id: number;
      slug: string;
    }[];
    const wettkampf = categories.find((c) => c.slug === "wettkampf")!.id;

    ids.published = await create("rep", "Öffentlich", {
      categoryIds: [wettkampf],
      description: "Für alle sichtbar",
    });
    await publish(ids.published);
    ids.water = await create("fed", "Wasserball-Turnier", { calendar: "water_polo", clubId: null });
    await publish(ids.water);
    ids.draft = await create("rep", "Entwurf");
    ids.pending = await create("rep", "Eingereicht");
    await call("POST", `/events/${ids.pending}/submit`, "rep");
    ids.unpublished = await create("rep", "Depubliziert");
    await publish(ids.unpublished);
    await call("POST", `/events/${ids.unpublished}/unpublish`, "fed");
    ids.deleted = await create("rep", "Gelöscht");
    await publish(ids.deleted);
    await call("DELETE", `/events/${ids.deleted}`, "fed");
  });

  afterAll(async () => {
    if (!enabled) return;
    await app?.close();
    const logs = await admin.request(
      readItems("audit_logs", {
        filter: { entity_id: { _in: created } },
        fields: ["id"],
        limit: -1,
      }),
    );
    if (logs.length)
      await admin.request(
        deleteItems(
          "audit_logs",
          logs.map((l) => l.id as string),
        ),
      );
    if (created.length) await admin.request(deleteItems("events", created));
  });

  it("lists only published, non-deleted events – without authentication", async () => {
    const list = (await call("GET", `/public/events?${range}`)).json() as { title: string }[];
    const mine = titles(list.filter((e) => e.title.endsWith(run)));
    expect(mine.sort()).toEqual(["Wasserball-Turnier", "Öffentlich"].sort());
  });

  it("filters by calendar, club and category", async () => {
    const byCalendar = (await call("GET", `/public/events?${range}&calendar=water_polo`)).json();
    expect(titles(byCalendar.filter((e: { title: string }) => e.title.endsWith(run)))).toEqual([
      "Wasserball-Turnier",
    ]);
    const byClub = (await call("GET", `/public/events?${range}&club=sv-musterstadt`)).json();
    expect(titles(byClub.filter((e: { title: string }) => e.title.endsWith(run)))).toEqual([
      "Öffentlich",
    ]);
    const byCategory = (await call("GET", `/public/events?${range}&category=wettkampf`)).json();
    expect(titles(byCategory.filter((e: { title: string }) => e.title.endsWith(run)))).toEqual([
      "Öffentlich",
    ]);
    expect((await call("GET", `/public/events?from=2027-01-01&to=2028-12-31`)).statusCode).toBe(
      400,
    ); // range limit
  });

  it("generates readable slugs on first publication and exposes no internal fields", async () => {
    const detail = (await call("GET", `/events/${ids.published}`, "rep")).json();
    expect(detail.slug).toBe(`2027-06-12-oeffentlich-${run}`);
    const pub = await call("GET", `/public/events/${detail.slug}`);
    expect(pub.statusCode).toBe(200);
    expect(pub.json()).toMatchObject({
      title: `Öffentlich ${run}`,
      organizer: "SV Musterstadt e. V.",
      description: "Für alle sichtbar",
    });
    for (const key of [
      "status",
      "reviewComment",
      "submittedBy",
      "createdBy",
      "allowedActions",
      "deleted",
      "pendingRemoval",
    ]) {
      expect(pub.json()).not.toHaveProperty(key);
    }
    expect(JSON.stringify(pub.json())).not.toMatch(/vertreter@example\.com/);
  });

  it("does not expose unpublished or deleted events by slug", async () => {
    for (const key of ["unpublished", "deleted"]) {
      const slug = (await call("GET", `/events/${ids[key]}`, "fed")).json().slug;
      expect(slug).toBeTruthy();
      expect((await call("GET", `/public/events/${slug}`)).statusCode).toBe(404);
    }
    expect((await call("GET", "/public/events/does-not-exist")).statusCode).toBe(404);
  });

  it("de-duplicates slugs and keeps them frozen", async () => {
    const twin = await create("fed", "Öffentlich", { clubId: null, organizerType: "federation" });
    await publish(twin);
    expect((await call("GET", `/events/${twin}`, "fed")).json().slug).toBe(
      `2027-06-12-oeffentlich-${run}-2`,
    );
    await call("PATCH", `/events/${twin}`, "fed", { title: `Umbenannt ${run}` });
    await call("POST", `/events/${twin}/unpublish`, "fed");
    await publish(twin);
    expect((await call("GET", `/events/${twin}`, "fed")).json().slug).toBe(
      `2027-06-12-oeffentlich-${run}-2`,
    );
  });

  it("serves WebCal feeds with only published events", async () => {
    const all = await call("GET", "/public/calendar/alle.ics");
    expect(all.statusCode).toBe(200);
    expect(all.headers["content-type"]).toContain("text/calendar");
    const ics = all.body.replace(/\r\n /g, ""); // unfold
    expect(ics).toContain(`SUMMARY:Öffentlich ${run}`);
    expect(ics).toContain(`SUMMARY:Wasserball-Turnier ${run}`);
    for (const hidden of ["Entwurf", "Eingereicht", "Depubliziert", "Gelöscht"]) {
      expect(ics).not.toContain(`SUMMARY:${hidden} ${run}`);
    }
    expect(ics).toContain("DTSTART:20270612T080000Z"); // 10:00 CEST

    const swimming = (await call("GET", "/public/calendar/schwimmen.ics")).body.replace(
      /\r\n /g,
      "",
    );
    expect(swimming).toContain(`SUMMARY:Öffentlich ${run}`);
    expect(swimming).not.toContain(`SUMMARY:Wasserball-Turnier ${run}`);
    const water = (await call("GET", "/public/calendar/wasserball.ics")).body.replace(/\r\n /g, "");
    expect(water).toContain(`SUMMARY:Wasserball-Turnier ${run}`);

    for (const feed of ["synchronschwimmen", "masters", "allgemein"]) {
      expect((await call("GET", `/public/calendar/${feed}.ics`)).statusCode).toBe(200);
    }
    expect((await call("GET", "/public/calendar/geheim.ics")).statusCode).toBe(404);
  });

  it("provides filter options", async () => {
    const filters = (await call("GET", "/public/calendar-filters")).json();
    expect(filters.categories.map((c: { slug: string }) => c.slug)).toEqual(
      expect.arrayContaining(["wettkampf", "kampfrichter", "verband"]),
    );
    expect(filters.clubs.map((c: { slug: string }) => c.slug)).toContain("sv-musterstadt");
  });
});
