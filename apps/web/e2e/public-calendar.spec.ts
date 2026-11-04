import { expect, test, type Page } from "@playwright/test";
import { adminDeleteEvents, login, SEED_PASSWORD } from "./helpers";

/**
 * Critical journey (spec §15.1): a public visitor sees an approved event in the
 * calendar views, the detail page and the WebCal feed – but never a draft.
 */
const run = Math.random().toString(36).slice(2, 8);
const published = `E2E Sommerfest ${run}`;
const draft = `E2E Geheimtreffen ${run}`;
const now = new Date();
const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15));
const date = target.toISOString().slice(0, 10);
const month = date.slice(0, 7);

test.describe.configure({ mode: "serial" });
test.skip(
  !SEED_PASSWORD || !process.env.DIRECTUS_ADMIN_TOKEN,
  "needs DEV_SEED_PASSWORD and DIRECTUS_ADMIN_TOKEN",
);
test.afterAll(async () => adminDeleteEvents(run));

async function createEvent(page: Page, title: string, publish: boolean) {
  await page.goto("/intern/veranstaltungen/neu");
  await page.getByRole("textbox", { name: "Titel", exact: true }).fill(title);
  await page.getByRole("combobox", { name: "Kalender" }).selectOption("general");
  await page.locator('input[name="startDate"]').fill(date);
  await page.locator('input[name="endDate"]').fill(date);
  await page
    .getByRole("textbox", { name: "Schwimmhalle / Veranstaltungsort" })
    .fill("Freibad Musterstadt");
  await page.getByRole("textbox", { name: "Beschreibung" }).fill("Mit Grillen und Staffeln.");
  await page.getByRole("button", { name: "Als Entwurf anlegen" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  if (publish) {
    await page.getByRole("button", { name: "Direkt veröffentlichen" }).click();
    await expect(page.getByRole("link", { name: "Öffentliche Seite ansehen" })).toBeVisible();
  }
}

test("federation publishes an event; a draft stays internal", async ({ page }) => {
  await login(page, "verband@example.com", SEED_PASSWORD);
  await createEvent(page, published, true);
  await createEvent(page, draft, false);
});

test("visitor finds the event in list, filters, month view, detail page and feed", async ({
  page,
  request,
}) => {
  await page.goto("/veranstaltungen");
  await expect(page.getByRole("link", { name: published })).toBeVisible();
  await expect(page.getByRole("link", { name: draft })).toHaveCount(0);

  // filter by another calendar hides it, the matching calendar shows it
  await page.getByRole("combobox", { name: "Kalender" }).selectOption("wasserball");
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page).toHaveURL(/kalender=wasserball/);
  await expect(page.getByRole("link", { name: published })).toHaveCount(0);
  await page.goto("/veranstaltungen?kalender=allgemein");
  await expect(page.getByRole("link", { name: published })).toBeVisible();

  // month view
  await page.goto(`/veranstaltungen?ansicht=monat&monat=${month}`);
  await expect(
    page.getByRole("link", { name: published }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: draft })).toHaveCount(0);

  // year view
  await page.goto(`/veranstaltungen?ansicht=jahr&jahr=${date.slice(0, 4)}`);
  await expect(page.getByRole("link", { name: published })).toBeVisible();

  // detail page
  await page.getByRole("link", { name: published }).click();
  await expect(page.getByRole("heading", { name: published, level: 1 })).toBeVisible();
  await expect(page.getByText("Mit Grillen und Staffeln.")).toBeVisible();
  await expect(page.getByText("BSV-SWS")).toBeVisible();
  expect(page.url()).toMatch(new RegExp(`/veranstaltungen/${date}-e2e-sommerfest-${run}$`));

  // feeds
  const all = (await (await request.get("/kalender/alle.ics")).text()).replace(/\r\n /g, "");
  expect(all).toContain(`SUMMARY:${published}`);
  expect(all).not.toContain(draft);
  const general = await request.get("/kalender/allgemein.ics");
  expect(general.headers()["content-type"]).toContain("text/calendar");
  expect((await general.text()).replace(/\r\n /g, "")).toContain(`SUMMARY:${published}`);
  expect((await request.get("/kalender/geheim.ics")).status()).toBe(404);
});
