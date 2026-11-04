/**
 * Phase 5 integration tests against a REAL Directus: CMS permissions (as Studio
 * uses them), public navigation/pages/news/clubs/redirects/media rules.
 * Requires apply + seed. Run: test:integration.
 */
import { createDirectus, deleteItems, rest, staticToken } from "@directus/sdk";
import { DIRECTUS_FOLDER_IDS } from "@bsv-sws/directus";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { createFakeMailer } from "../../src/lib/mailer.js";

const enabled = process.env.INTEGRATION === "1" && !!process.env.DIRECTUS_ADMIN_TOKEN;

describe.skipIf(!enabled)("Phase 5 CMS and public content (real Directus)", () => {
  const env = enabled ? loadEnv() : (undefined as never);
  const run = randomUUID().slice(0, 8);
  const admin = enabled
    ? createDirectus(env.DIRECTUS_URL)
        .with(staticToken(process.env.DIRECTUS_ADMIN_TOKEN!))
        .with(rest())
    : (undefined as never);
  const created: Record<string, (string | number)[]> = {
    articles: [],
    article_categories: [],
    pages: [],
    navigation_items: [],
    redirects: [],
    files: [],
    clubs: [],
  };
  let app: Awaited<ReturnType<typeof buildApp>>;
  const tokens: Record<string, string> = {};

  async function login(email: string) {
    const res = await fetch(new URL("/auth/login", env.DIRECTUS_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: process.env.DEV_SEED_PASSWORD }),
    });
    return ((await res.json()) as { data: { access_token: string } }).data.access_token;
  }
  /** Directus REST as a given user – exactly what Studio does. */
  async function directus(as: string, method: string, path: string, body?: unknown) {
    const res = await fetch(new URL(path, env.DIRECTUS_URL), {
      method,
      headers: { authorization: `Bearer ${tokens[as]}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: res.status,
      json: (await res.json().catch(() => null)) as { data?: Record<string, unknown> } | null,
    };
  }
  async function createAs(as: string, collection: string, body: Record<string, unknown>) {
    const res = await directus(as, "POST", `/items/${collection}`, body);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    created[collection]!.push(res.json!.data!.id as string);
    return res.json!.data!;
  }
  async function uploadAs(as: string, folder: string | null) {
    const form = new FormData();
    if (folder) form.append("folder", folder);
    form.append(
      "file",
      new Blob(
        [
          Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64",
          ),
        ],
        { type: "image/png" },
      ),
      "pixel.png",
    );
    const res = await fetch(new URL("/files", env.DIRECTUS_URL), {
      method: "POST",
      headers: { authorization: `Bearer ${tokens[as]}` },
      body: form,
    });
    const id = ((await res.json()) as { data: { id: string } }).data.id;
    created.files!.push(id);
    return id;
  }
  const get = (url: string) => app.inject({ method: "GET", url });

  beforeAll(async () => {
    app = await buildApp(env, { logger: false }, { mailer: createFakeMailer() });
    tokens.fed = await login("verband@example.com");
    tokens.rep = await login("vertreter@example.com");
    tokens.admin = process.env.DIRECTUS_ADMIN_TOKEN!;
  });

  afterAll(async () => {
    if (!enabled) return;
    await app?.close();
    for (const collection of [
      "navigation_items",
      "redirects",
      "articles",
      "article_categories",
      "pages",
      "clubs",
    ]) {
      const ids = created[collection]!;
      if (ids.length) await admin.request(deleteItems(collection as never, ids as never));
    }
    for (const id of created.files!)
      await fetch(new URL(`/files/${id}`, env.DIRECTUS_URL), {
        method: "DELETE",
        headers: { authorization: `Bearer ${tokens.admin}` },
      });
  });

  it("base navigation and pages exist (spec §9.1)", async () => {
    const nav = (await get("/public/navigation")).json();
    const labels = nav.main.map((n: { label: string }) => n.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Startseite",
        "Veranstaltungen",
        "News",
        "Sportarten",
        "Verband",
        "Team Westsachsen",
        "Intern",
      ]),
    );
    const verband = nav.main.find((n: { label: string }) => n.label === "Verband");
    expect(verband.children.map((c: { href: string }) => c.href)).toContain("/verband/vorstand");
    expect(nav.footer.map((n: { label: string }) => n.label)).toEqual(["Impressum", "Datenschutz"]);

    const page = (await get("/public/pages?path=/verband/vorstand")).json();
    expect(page).toMatchObject({
      title: "Vorstand & Fachwarte",
      path: "/verband/vorstand",
      breadcrumbs: [{ title: "Verband", path: "/verband" }],
    });
    expect((await get("/public/pages?path=/verband")).json().children).toHaveLength(7);
  });

  it("federation edits content in Directus (Studio permissions); club users cannot", async () => {
    const cat = await createAs("fed", "article_categories", {
      name: `Kat ${run}`,
      slug: `kat-${run}`,
    });
    expect(cat.id).toBeTruthy();
    expect(
      (
        await directus("rep", "POST", "/items/articles", {
          title: "x",
          slug: `x-${run}`,
          category: cat.id,
        })
      ).status,
    ).toBe(403);
    expect((await directus("rep", "GET", "/items/pages")).status).toBe(403);
  });

  it("news: only published and due articles, paginated, category filter, sanitized content", async () => {
    const cat = await createAs("fed", "article_categories", {
      name: `News ${run}`,
      slug: `news-${run}`,
    });
    const imageId = await uploadAs("fed", DIRECTUS_FOLDER_IDS.publicMedia);
    const base = { category: cat.id };
    await createAs("fed", "articles", {
      ...base,
      status: "published",
      title: `Neu ${run}`,
      slug: `neu-${run}`,
      published_at: "2026-01-02T10:00:00Z",
      teaser: "Kurz",
      featured_image: imageId,
      content: `<h1>Titel</h1><p onclick="x()">Text</p><script>alert(1)</script><img src="${env.DIRECTUS_URL}/assets/${imageId}?width=600">`,
    });
    await createAs("fed", "articles", {
      ...base,
      status: "published",
      title: `Alt ${run}`,
      slug: `alt-${run}`,
      published_at: "2026-01-01T10:00:00Z",
    });
    await createAs("fed", "articles", {
      ...base,
      status: "draft",
      title: `Entwurf ${run}`,
      slug: `entwurf-${run}`,
    });
    await createAs("fed", "articles", {
      ...base,
      status: "published",
      title: `Zukunft ${run}`,
      slug: `zukunft-${run}`,
      published_at: "2099-01-01T00:00:00Z",
    });

    const list = (await get(`/public/articles?category=news-${run}&pageSize=1`)).json();
    expect(list).toMatchObject({ total: 2, pageCount: 2, page: 1 });
    expect(list.items[0]).toMatchObject({
      title: `Neu ${run}`,
      author: "Verband Test",
      category: { slug: `news-${run}` },
    });
    expect(
      (await get(`/public/articles?category=news-${run}&page=2&pageSize=1`)).json().items[0].title,
    ).toBe(`Alt ${run}`);

    const detail = (await get(`/public/articles/neu-${run}`)).json();
    expect(detail.contentHtml).toContain("<h2>Titel</h2>");
    expect(detail.contentHtml).not.toMatch(/script|onclick/);
    expect(detail.contentHtml).toContain(`src="/medien/${imageId}?width=600"`);
    expect((await get(`/public/articles/entwurf-${run}`)).statusCode).toBe(404);
    expect((await get(`/public/articles/zukunft-${run}`)).statusCode).toBe(404);
  });

  it("pages: drafts, unpublished parents and non-public visibility are not reachable; nav hides them", async () => {
    const parent = await createAs("fed", "pages", {
      status: "draft",
      title: "Eltern",
      slug: `eltern-${run}`,
    });
    await createAs("fed", "pages", {
      status: "published",
      title: "Kind",
      slug: "kind",
      parent: parent.id,
    });
    await createAs("fed", "pages", {
      status: "published",
      visibility: "club",
      title: "Intern",
      slug: `intern-${run}`,
      content: "<p>geheim</p>",
    });
    const pub = await createAs("fed", "pages", {
      status: "published",
      title: "Öffentlich",
      slug: `oeffentlich-${run}`,
      content: "<p>hallo</p>",
    });
    expect((await get(`/public/pages?path=/eltern-${run}/kind`)).statusCode).toBe(404);
    expect((await get(`/public/pages?path=/intern-${run}`)).statusCode).toBe(404);
    expect((await get(`/public/pages?path=/oeffentlich-${run}`)).json().contentHtml).toBe(
      "<p>hallo</p>",
    );

    await createAs("fed", "navigation_items", {
      menu: "main",
      label: `Draft-Link ${run}`,
      link_type: "page",
      page: parent.id,
    });
    await createAs("fed", "navigation_items", {
      menu: "main",
      label: `Pub-Link ${run}`,
      link_type: "page",
      page: pub.id,
    });
    const labels = JSON.stringify((await get("/public/navigation")).json());
    expect(labels).toContain(`Pub-Link ${run}`);
    expect(labels).not.toContain(`Draft-Link ${run}`);
  });

  it("media: only files in the public folder are served", async () => {
    const publicFile = await uploadAs("fed", DIRECTUS_FOLDER_IDS.publicMedia);
    const privateFile = await uploadAs("admin", null);
    const ok = await get(`/public/media/${publicFile}?width=100`);
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["content-type"]).toContain("image/");
    expect((await get(`/public/media/${privateFile}`)).statusCode).toBe(404);
  });

  it("clubs: generated from active club records", async () => {
    const inactive = await createAs("admin", "clubs", {
      name: `Inaktiv ${run}`,
      slug: `inaktiv-${run}`,
      active: false,
    });
    const clubs = (await get("/public/clubs")).json() as { slug: string }[];
    expect(clubs.map((c) => c.slug)).toContain("sv-musterstadt");
    expect(clubs.map((c) => c.slug)).not.toContain(`inaktiv-${run}`);
    expect((await get("/public/clubs/sv-musterstadt")).json()).toMatchObject({
      name: "SV Musterstadt e. V.",
      sports: ["swimming", "masters"],
    });
    expect((await get(`/public/clubs/inaktiv-${run}`)).statusCode).toBe(404);
    expect(inactive.id).toBeTruthy();
  });

  it("redirects: exact path+query first, then path; inactive ignored", async () => {
    await createAs("fed", "redirects", {
      from_path: `/index.php?option=com_content&id=${run}`,
      to_path: "/verband/satzung",
      permanent: true,
    });
    await createAs("fed", "redirects", {
      from_path: `/alt-${run}`,
      to_path: "/news",
      permanent: false,
    });
    await createAs("fed", "redirects", {
      from_path: `/aus-${run}`,
      to_path: "/news",
      active: false,
    });
    expect(
      (
        await get(
          `/public/redirects?path=/index.php&query=${encodeURIComponent(`option=com_content&id=${run}`)}`,
        )
      ).json(),
    ).toEqual({ to: "/verband/satzung", permanent: true });
    expect((await get(`/public/redirects?path=/alt-${run}&query=x=1`)).json()).toEqual({
      to: "/news",
      permanent: false,
    });
    expect((await get(`/public/redirects?path=/aus-${run}`)).statusCode).toBe(404);
  });

  it("resolve: existence checks for the proxy (real status codes)", async () => {
    const r = async (path: string) =>
      (await get(`/public/resolve?path=${encodeURIComponent(path)}`)).json();
    expect(await r("/verband/vorstand")).toEqual({ action: "ok" });
    expect(await r("/vereine/sv-musterstadt")).toEqual({ action: "ok" });
    expect(await r(`/vereine/nope-${run}`)).toEqual({ action: "not_found" });
    expect(await r(`/news/nope-${run}`)).toEqual({ action: "not_found" });
    expect(await r(`/veranstaltungen/nope-${run}`)).toEqual({ action: "not_found" });
    expect(await r(`/alt-${run}`)).toEqual({ action: "redirect", to: "/news", permanent: false });
    expect(await r(`/gibt-es-nicht-${run}`)).toEqual({ action: "not_found" });
  });
});
