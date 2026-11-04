import { expect, test } from "@playwright/test";
import { ADMIN_TOKEN, DIRECTUS, SEED_PASSWORD } from "./helpers";

/**
 * Phase 5 journey: the federation edits content in Directus (same API calls as
 * Studio) and visitors see news, pages, navigation changes, club pages and
 * redirects on the website.
 */
const run = Math.random().toString(36).slice(2, 8);
const created: { collection: string; id: string | number }[] = [];
let fedToken = "";

async function directus(method: string, path: string, body?: unknown, token = fedToken) {
  const res = await fetch(`${DIRECTUS}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : ((await res.json()) as { data: Record<string, unknown> }).data;
}
async function create(collection: string, body: Record<string, unknown>) {
  const item = (await directus("POST", `/items/${collection}`, body))!;
  created.push({ collection, id: item.id as string });
  return item;
}

test.describe.configure({ mode: "serial" });
test.skip(!SEED_PASSWORD || !ADMIN_TOKEN, "needs DEV_SEED_PASSWORD and DIRECTUS_ADMIN_TOKEN");

test.beforeAll(async () => {
  const res = await fetch(`${DIRECTUS}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "verband@example.com", password: SEED_PASSWORD }),
  });
  fedToken = ((await res.json()) as { data: { access_token: string } }).data.access_token;
});

test.afterAll(async () => {
  for (const { collection, id } of created.reverse()) {
    await directus("DELETE", `/items/${collection}/${id}`, undefined, ADMIN_TOKEN).catch(
      () => undefined,
    );
  }
});

test("news published in Directus appears on home, list, category and detail page", async ({
  page,
}) => {
  const category = await create("article_categories", {
    name: `Berichte ${run}`,
    slug: `berichte-${run}`,
  });
  await create("articles", {
    status: "published",
    title: `Bezirksmeister gekürt ${run}`,
    slug: `bezirksmeister-${run}`,
    category: category.id,
    teaser: "Spannende Rennen am Wochenende.",
    content:
      "<h2>Ergebnisse</h2><p>Alle Ergebnisse im <strong>Überblick</strong>.</p><script>alert(1)</script>",
    published_at: new Date().toISOString(),
  });

  await page.goto("/");
  await expect(page.getByRole("link", { name: `Bezirksmeister gekürt ${run}` })).toBeVisible();

  await page.goto("/news");
  await page.getByRole("link", { name: `Bezirksmeister gekürt ${run}` }).click();
  await expect(page).toHaveURL(new RegExp(`/news/bezirksmeister-${run}$`));
  await expect(page.getByRole("heading", { name: "Ergebnisse" })).toBeVisible();
  expect(await page.locator(".rich-content").innerHTML()).not.toContain("script");

  await page.getByRole("link", { name: `Berichte ${run}` }).click();
  await expect(page.getByRole("heading", { name: `News: Berichte ${run}` })).toBeVisible();
});

test("navigation is managed in Directus: new entries and reordering show up immediately", async ({
  page,
}) => {
  const a = await create("navigation_items", {
    menu: "main",
    label: `Zuerst ${run}`,
    link_type: "route",
    route: "/vereine",
    sort: 900,
  });
  const b = await create("navigation_items", {
    menu: "main",
    label: `Danach ${run}`,
    link_type: "url",
    url: "https://www.dsv.de",
    sort: 901,
  });
  // The navigation streams in (Suspense) – poll instead of reading once.
  const order = async () => {
    await page.goto("/news");
    const nav = page.getByRole("navigation", { name: "Hauptnavigation", exact: true });
    await nav.getByRole("link", { name: "Startseite" }).waitFor();
    const labels = await nav.getByRole("link").allTextContents();
    return labels.filter((l) => l.endsWith(run));
  };
  await expect.poll(order).toEqual([`Zuerst ${run}`, `Danach ${run}`]);
  await directus("PATCH", `/items/navigation_items/${a.id}`, { sort: 902 });
  await expect.poll(order).toEqual([`Danach ${run}`, `Zuerst ${run}`]);
  expect(b.id).toBeTruthy();

  // a base dropdown entry leads to its CMS page
  await page.goto("/");
  const main = page.getByRole("navigation", { name: "Hauptnavigation", exact: true });
  await main.getByRole("link", { name: "Verband", exact: true }).hover();
  await main.getByRole("link", { name: "Vorstand & Fachwarte" }).click();
  await expect(page).toHaveURL(/\/verband\/vorstand$/);
  await expect(page.getByRole("heading", { name: "Vorstand & Fachwarte", level: 1 })).toBeVisible();
});

test("page edits are visible immediately; drafts are not reachable", async ({ page }) => {
  const p = await create("pages", {
    status: "published",
    title: `Ehrenamt ${run}`,
    slug: `ehrenamt-${run}`,
    content: "<p>Version 1</p>",
  });
  await page.goto(`/ehrenamt-${run}`);
  await expect(page.getByText("Version 1")).toBeVisible();
  await directus("PATCH", `/items/pages/${p.id}`, { content: "<p>Version 2</p>" });
  await page.reload();
  await expect(page.getByText("Version 2")).toBeVisible();
  await directus("PATCH", `/items/pages/${p.id}`, { status: "draft" });
  expect((await page.goto(`/ehrenamt-${run}`))!.status()).toBe(404);
});

test("club pages are generated from club records", async ({ page }) => {
  await page.goto("/vereine");
  await page.getByRole("link", { name: "SV Musterstadt e. V." }).click();
  await expect(page).toHaveURL(/\/vereine\/sv-musterstadt$/);
  await expect(page.getByRole("heading", { name: "SV Musterstadt e. V.", level: 1 })).toBeVisible();
  await expect(
    page.locator("dd", { hasText: "Schwimmen, Masters" }).filter({ visible: true }),
  ).toBeVisible();
});

test("old URLs are redirected with a real HTTP redirect", async ({ request }) => {
  await create("redirects", {
    from_path: `/alte-seite-${run}`,
    to_path: "/verband/satzung",
    permanent: true,
  });
  const res = await request.get(`/alte-seite-${run}`, { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers()["location"]).toBe("/verband/satzung");
  expect((await request.get(`/wirklich-nicht-da-${run}`, { maxRedirects: 0 })).status()).toBe(404);
});
