/**
 * Phase 6 integration tests against a REAL Directus: protected pages and files
 * for every visibility level, internal navigation, status resolution.
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

describe.skipIf(!enabled)("Phase 6 internal area and protected content (real Directus)", () => {
  const env = enabled ? loadEnv() : (undefined as never);
  const run = randomUUID().slice(0, 8);
  const admin = enabled
    ? createDirectus(env.DIRECTUS_URL)
        .with(staticToken(process.env.DIRECTUS_ADMIN_TOKEN!))
        .with(rest())
    : (undefined as never);
  const created: Record<string, (string | number)[]> = {
    pages: [],
    navigation_items: [],
    files: [],
  };
  const tokens: Record<string, string> = {};
  const files: Record<string, string> = {};
  let app: Awaited<ReturnType<typeof buildApp>>;

  async function login(email: string) {
    const res = await fetch(new URL("/auth/login", env.DIRECTUS_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: process.env.DEV_SEED_PASSWORD }),
    });
    return ((await res.json()) as { data: { access_token: string } }).data.access_token;
  }
  async function create(collection: string, body: Record<string, unknown>) {
    const res = await fetch(new URL(`/items/${collection}`, env.DIRECTUS_URL), {
      method: "POST",
      headers: { authorization: `Bearer ${tokens.fed}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = ((await res.json()) as { data: { id: string } }).data;
    created[collection]!.push(data.id);
    return data;
  }
  async function upload(folder: string) {
    const form = new FormData();
    form.append("folder", folder);
    form.append(
      "file",
      new Blob([Buffer.from("%PDF-1.4 test")], { type: "application/pdf" }),
      "dokument.pdf",
    );
    const res = await fetch(new URL("/files", env.DIRECTUS_URL), {
      method: "POST",
      headers: { authorization: `Bearer ${tokens.fed}` },
      body: form,
    });
    const id = ((await res.json()) as { data: { id: string } }).data.id;
    created.files!.push(id);
    return id;
  }
  const get = (url: string, as?: string) =>
    app.inject({
      method: "GET",
      url,
      headers: as ? { authorization: `Bearer ${tokens[as]}` } : {},
    });
  const link = (id: string) => `<p><a href="${env.DIRECTUS_URL}/assets/${id}">Dokument</a></p>`;
  const path = (slug: string) => `/${slug}-${run}`;

  beforeAll(async () => {
    app = await buildApp(env, { logger: false }, { mailer: createFakeMailer() });
    tokens.member = await login("mitglied@example.com");
    tokens.rep = await login("vertreter@example.com");
    tokens.fed = await login("verband@example.com");
    files.club = await upload(DIRECTUS_FOLDER_IDS.pageDocuments);
    files.fed = await upload(DIRECTUS_FOLDER_IDS.pageDocuments);
    files.pub = await upload(DIRECTUS_FOLDER_IDS.pageDocuments);
    files.orphan = await upload(DIRECTUS_FOLDER_IDS.pageDocuments);

    const club = await create("pages", {
      status: "published",
      visibility: "club",
      title: "Vereinsinfos",
      slug: `vereinsinfos-${run}`,
      content: link(files.club),
    });
    await create("pages", {
      status: "published",
      visibility: "public",
      title: "Unterseite",
      slug: "unterseite",
      parent: club.id,
    });
    await create("pages", {
      status: "published",
      visibility: "club_representative",
      title: "Für Vertreter",
      slug: `vertreter-${run}`,
    });
    await create("pages", {
      status: "published",
      visibility: "federation",
      title: "Verbandsintern",
      slug: `verbandsintern-${run}`,
      content: link(files.fed),
    });
    await create("pages", {
      status: "published",
      visibility: "public",
      title: "Öffentliche Doku",
      slug: `oeffentlich-${run}`,
      content: link(files.pub),
    });
    await create("pages", {
      status: "draft",
      visibility: "club",
      title: "Entwurf",
      slug: `entwurf-${run}`,
      content: link(files.orphan),
    });

    for (const [label, slug, visibility] of [
      ["Infos", "vereinsinfos", "club"],
      ["Vertreter", "vertreter", "club_representative"],
      ["Verband", "verbandsintern", "federation"],
    ] as const) {
      const page =
        created.pages![["vereinsinfos", "x", "vertreter", "verbandsintern"].indexOf(slug)]!;
      await create("navigation_items", {
        menu: "internal",
        label: `${label} ${run}`,
        link_type: "page",
        page,
        visibility,
      });
    }
  });

  afterAll(async () => {
    if (!enabled) return;
    await app?.close();
    if (created.navigation_items!.length)
      await admin.request(
        deleteItems("navigation_items" as never, created.navigation_items as never),
      );
    // children first (parent relation is NO ACTION)
    if (created.pages!.length) {
      await admin.request(deleteItems("pages" as never, [created.pages![1]!] as never));
      await admin.request(
        deleteItems("pages" as never, created.pages!.filter((_, i) => i !== 1) as never),
      );
    }
    for (const id of created.files!) {
      await fetch(new URL(`/files/${id}`, env.DIRECTUS_URL), {
        method: "DELETE",
        headers: { authorization: `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}` },
      });
    }
  });

  it("protected pages: 401 without login, 403 for insufficient level, 200 otherwise", async () => {
    const page = (p: string, as?: string) =>
      get(`/internal/pages?path=${encodeURIComponent(p)}`, as);
    expect((await page(path("vereinsinfos"))).statusCode).toBe(401);
    expect((await page(path("vereinsinfos"), "member")).json()).toMatchObject({
      title: "Vereinsinfos",
      visibility: "club",
      href: `/intern/seiten/vereinsinfos-${run}`,
    });
    expect((await page(path("vertreter"), "member")).statusCode).toBe(403);
    expect((await page(path("vertreter"), "rep")).statusCode).toBe(200);
    expect((await page(path("verbandsintern"), "rep")).statusCode).toBe(403);
    expect((await page(path("verbandsintern"), "fed")).statusCode).toBe(200);
    expect((await page(path("entwurf"), "fed")).statusCode).toBe(404);
    // 403 responses reveal nothing about the page
    expect((await page(path("vertreter"), "member")).body).not.toContain("Für Vertreter");
  });

  it("a page is never more visible than its parent", async () => {
    const child = `/vereinsinfos-${run}/unterseite`;
    expect((await get(`/public/pages?path=${encodeURIComponent(child)}`)).statusCode).toBe(404);
    const page = (await get(`/internal/pages?path=${encodeURIComponent(child)}`, "member")).json();
    expect(page).toMatchObject({
      visibility: "club",
      breadcrumbs: [{ title: "Vereinsinfos", href: `/intern/seiten/vereinsinfos-${run}` }],
    });
    const parent = (
      await get(`/internal/pages?path=${encodeURIComponent(path("vereinsinfos"))}`, "member")
    ).json();
    expect(parent.children).toEqual([{ title: "Unterseite", href: `/intern/seiten${child}` }]);
  });

  it("public URLs of protected pages lead into the internal area; internal URLs of public pages back out", async () => {
    expect(
      (await get(`/public/pages?path=${encodeURIComponent(path("vereinsinfos"))}`)).statusCode,
    ).toBe(404);
    expect(
      (await get(`/public/resolve?path=${encodeURIComponent(path("vereinsinfos"))}`)).json(),
    ).toEqual({
      action: "redirect",
      to: `/intern/seiten/vereinsinfos-${run}`,
      permanent: false,
    });
    const resolve = (p: string, as: string) =>
      get(`/internal/pages/resolve?path=${encodeURIComponent(p)}`, as);
    expect((await resolve(path("vertreter"), "member")).json()).toEqual({ action: "forbidden" });
    expect((await resolve(path("vertreter"), "rep")).json()).toEqual({ action: "ok" });
    expect((await resolve(path("oeffentlich"), "member")).json()).toEqual({
      action: "redirect",
      to: `/oeffentlich-${run}`,
      permanent: true,
    });
    expect((await resolve("/gibt-es-nicht", "member")).json()).toEqual({ action: "not_found" });
  });

  it("files have the visibility of the pages that reference them (spec §8.5)", async () => {
    const file = (id: string, as?: string) => get(`/content/files/${id}`, as);
    expect((await file(files.club!)).statusCode).toBe(401);
    expect((await file(files.club!, "member")).statusCode).toBe(200);
    expect((await file(files.club!, "member")).headers["cache-control"]).toBe("private, no-store");
    expect((await file(files.fed!, "member")).statusCode).toBe(403);
    expect((await file(files.fed!, "rep")).statusCode).toBe(403);
    expect((await file(files.fed!, "fed")).statusCode).toBe(200);
    const pub = await file(files.pub!);
    expect(pub.statusCode).toBe(200);
    expect(pub.headers["cache-control"]).toContain("public");
    // only referenced by a draft → nobody can open it, not even by copying the URL
    expect((await file(files.orphan!, "fed")).statusCode).toBe(404);
    // content links point to the file proxy
    const page = (
      await get(`/internal/pages?path=${encodeURIComponent(path("vereinsinfos"))}`, "member")
    ).json();
    expect(page.contentHtml).toContain(`href="/medien/${files.club}"`);
  });

  it("internal navigation shows each level only its entries", async () => {
    const labels = async (as: string) =>
      ((await get("/internal/navigation", as)).json().internal as { label: string }[])
        .map((n) => n.label)
        .filter((l) => l.endsWith(run));
    expect(await labels("member")).toEqual([`Infos ${run}`]);
    expect(await labels("rep")).toEqual([`Infos ${run}`, `Vertreter ${run}`]);
    expect(await labels("fed")).toEqual([`Infos ${run}`, `Vertreter ${run}`, `Verband ${run}`]);
    expect((await get("/internal/navigation")).statusCode).toBe(401);
    const item = (
      (await get("/internal/navigation", "member")).json().internal as {
        label: string;
        href: string;
      }[]
    ).find((n) => n.label === `Infos ${run}`);
    expect(item?.href).toBe(`/intern/seiten/vereinsinfos-${run}`);
    // the public navigation never contains internal entries
    expect(JSON.stringify((await get("/public/navigation")).json())).not.toContain(run);
  });

  it("home banner: Studio singleton, safe button target, banner image is public", async () => {
    const url = new URL("/items/homepage", env.DIRECTUS_URL);
    const headers = {
      authorization: `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`,
      "content-type": "application/json",
    };
    const original = (
      (await (await fetch(url, { headers })).json()) as { data: Record<string, unknown> }
    ).data;
    const patch = (body: Record<string, unknown>) =>
      fetch(url, { method: "PATCH", headers, body: JSON.stringify(body) });
    try {
      await patch({
        hero_enabled: true,
        hero_image: files.orphan,
        hero_button_label: "Los",
        hero_button_url: "javascript:alert(1)",
      });
      const home = (await get("/public/home")).json();
      expect(home.hero).toMatchObject({ imageId: files.orphan });
      // unsafe target → falls back to the next event (or no button)
      expect(home.hero.button?.href ?? "").not.toContain("javascript");
      // the banner image is public even outside "Öffentliche Medien" (otherwise 404 as orphan)
      const image = await get(`/content/files/${files.orphan}`);
      expect(image.statusCode).toBe(200);
      expect(image.headers["cache-control"]).toContain("public");

      await patch({ hero_button_url: "/news" });
      expect((await get("/public/home")).json().hero.button).toEqual({
        label: "Los",
        href: "/news",
        external: false,
      });
      await patch({ hero_enabled: false });
      expect((await get("/public/home")).json()).toEqual({ hero: null });
    } finally {
      const restore = Object.fromEntries(
        Object.entries(original).filter(([k]) => k !== "id" && k !== "date_updated"),
      );
      await patch(restore);
    }
  });
});
