import { expect, test } from "@playwright/test";
import { ADMIN_TOKEN, DIRECTUS, login, SEED_PASSWORD } from "./helpers";

/**
 * Phase 6 journey (spec §15.1 "user accessing internal content according to
 * permissions"): protected pages and documents per level, internal navigation,
 * login redirects and real 403 status codes.
 */
const run = Math.random().toString(36).slice(2, 8);
const PAGE_DOCUMENTS = "3deaf709-223c-4051-9463-e93b648490e9";
const created: { collection: string; id: string | number }[] = [];
let fedToken = "";
let fileId = "";

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

  const form = new FormData();
  form.append("folder", PAGE_DOCUMENTS);
  form.append(
    "file",
    new Blob([Buffer.from("%PDF-1.4 Protokoll")], { type: "application/pdf" }),
    "protokoll.pdf",
  );
  const up = await fetch(`${DIRECTUS}/files`, {
    method: "POST",
    headers: { authorization: `Bearer ${fedToken}` },
    body: form,
  });
  fileId = ((await up.json()) as { data: { id: string } }).data.id;

  const clubPage = await create("pages", {
    status: "published",
    visibility: "club",
    title: `Vereinsinformationen ${run}`,
    slug: `vereinsinfo-${run}`,
    content: `<p>Nur für Vereine.</p><p><a href="${DIRECTUS}/assets/${fileId}">Protokoll herunterladen</a></p>`,
  });
  const repPage = await create("pages", {
    status: "published",
    visibility: "club_representative",
    title: `Vertreterinfo ${run}`,
    slug: `vertreterinfo-${run}`,
    content: "<p>Nur für Vereinsvertreter.</p>",
  });
  await create("navigation_items", {
    menu: "internal",
    label: `Vereinsinfos ${run}`,
    link_type: "page",
    page: clubPage.id,
    visibility: "club",
  });
  await create("navigation_items", {
    menu: "internal",
    label: `Vertreter ${run}`,
    link_type: "page",
    page: repPage.id,
    visibility: "club_representative",
  });
});

test.afterAll(async () => {
  for (const { collection, id } of created.reverse()) {
    await directus("DELETE", `/items/${collection}/${id}`, undefined, ADMIN_TOKEN).catch(
      () => undefined,
    );
  }
  if (fileId)
    await directus("DELETE", `/files/${fileId}`, undefined, ADMIN_TOKEN).catch(() => undefined);
});

test("a shared public link to a protected page leads through login to the page", async ({
  page,
}) => {
  await page.goto(`/vereinsinfo-${run}`);
  await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fintern%2Fseiten%2Fvereinsinfo-${run}`));
  await page
    .getByRole("textbox", { name: "E-Mail-Adresse", exact: true })
    .fill("mitglied@example.com");
  await page.locator('input[name="password"]:visible').fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(new RegExp(`/intern/seiten/vereinsinfo-${run}$`));
  await expect(page.getByRole("heading", { name: `Vereinsinformationen ${run}` })).toBeVisible();
  await expect(page.getByText("Nur für Vereine.")).toBeVisible();
});

test("members see club content and documents, but not representative content", async ({
  page,
  request,
}) => {
  await login(page, "mitglied@example.com", SEED_PASSWORD);
  const nav = page.getByRole("navigation", { name: "Interne Navigation" });
  await expect(nav.getByRole("link", { name: `Vereinsinfos ${run}` })).toBeVisible();
  await expect(nav.getByRole("link", { name: `Vertreter ${run}` })).toHaveCount(0);

  // document of the club page: allowed with session
  await nav.getByRole("link", { name: `Vereinsinfos ${run}` }).click();
  const href = await page
    .getByRole("link", { name: "Protokoll herunterladen" })
    .getAttribute("href");
  expect(href).toBe(`/medien/${fileId}`);
  const download = await page.request.get(href!);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toContain("application/pdf");

  // representative page: real 403 without revealing the title
  const res = await page.goto(`/intern/seiten/vertreterinfo-${run}`);
  expect(res!.status()).toBe(403);
  await expect(page.getByText("Dafür fehlt dir die Berechtigung.")).toBeVisible();
  await expect(page.getByText(`Vertreterinfo ${run}`)).toHaveCount(0);

  // without session the document is not available (copying the URL does not help)
  const anonymous = await request.get(`/medien/${fileId}`, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(307);
  expect(anonymous.headers()["location"]).toContain("/login?next=");
});

test("representatives additionally see representative content and their task dashboard", async ({
  page,
}) => {
  await login(page, "vertreter@example.com", SEED_PASSWORD);
  await expect(page.getByRole("heading", { name: "Mein Verein – Aufgaben" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Interne Navigation" });
  await nav.getByRole("link", { name: `Vertreter ${run}` }).click();
  await expect(page.getByText("Nur für Vereinsvertreter.")).toBeVisible();
});

test("federation dashboard shows review tasks", async ({ page }) => {
  await login(page, "verband@example.com", SEED_PASSWORD);
  await expect(page.getByRole("heading", { name: "Verband", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Vereine ohne Vereinsvertreter/ })).toBeVisible();
});
