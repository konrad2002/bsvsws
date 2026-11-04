import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { adminDeleteEvents, login, SEED_PASSWORD } from "./helpers";

/** The status badge next to the page heading (history entries use the same words). */
const expectStatus = (page: Page, label: string) =>
  expect(page.locator("h1 ~ span").filter({ visible: true })).toHaveText(label);

/**
 * Critical journeys (spec §15.1): club creates and submits an event; federation
 * rejects with a comment; club fixes and resubmits; federation approves.
 */
const run = Math.random().toString(36).slice(2, 8);
const title = `E2E Pokalschwimmen ${run}`;

test.describe.configure({ mode: "serial" });
test.skip(
  !SEED_PASSWORD || !process.env.DIRECTUS_ADMIN_TOKEN,
  "needs DEV_SEED_PASSWORD and DIRECTUS_ADMIN_TOKEN",
);
test.afterAll(async () => adminDeleteEvents(run));

test("club creates and submits an event", async ({ page }) => {
  await login(page, "vertreter@example.com", SEED_PASSWORD);
  await page.getByRole("link", { name: "Veranstaltungen" }).click();
  await page.getByRole("link", { name: "Neue Veranstaltung" }).click();
  await page.getByRole("textbox", { name: "Titel", exact: true }).fill(title);
  await page.getByRole("combobox", { name: "Kalender" }).selectOption("swimming");
  await page.getByRole("checkbox", { name: "Wettkampf" }).check();
  await page.locator('input[name="startDate"]').fill("2027-05-08");
  await page.locator('input[name="endDate"]').fill("2027-05-08");
  await page.getByRole("textbox", { name: "Schwimmhalle / Veranstaltungsort" }).fill("Stadtbad");
  await page.getByRole("button", { name: "Eintrag hinzufügen" }).click();
  await page.getByRole("combobox", { name: "Typ des Eintrags" }).selectOption("admission");
  await page.getByRole("button", { name: "Als Entwurf anlegen" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expectStatus(page, "Entwurf");
  await expect(page.getByRole("textbox", { name: "Titel des Eintrags" })).toHaveValue("Einlass"); // schedule row title prefilled from type
  await page.getByRole("button", { name: "Zur Freigabe einreichen" }).click();
  await expectStatus(page, "Eingereicht");
  await expect(page.getByText("wartet auf die Prüfung")).toBeVisible();
});

test("federation rejects with a comment; club resubmits; federation approves", async ({
  page,
  browser,
}) => {
  await login(page, "verband@example.com", SEED_PASSWORD);
  await page.getByRole("link", { name: /^Prüfung/ }).click();
  await page.getByRole("link", { name: title }).click();
  await page.getByRole("button", { name: "Ablehnen" }).click();
  await page
    .getByRole("textbox", { name: "Ablehnungsgrund" })
    .fill("Bitte Adresse der Halle ergänzen.");
  await page.getByRole("button", { name: "Ablehnen" }).last().click();
  await expectStatus(page, "Abgelehnt");

  const club = await (await browser.newContext()).newPage();
  await login(club, "vertreter@example.com", SEED_PASSWORD);
  await club.goto("/intern/veranstaltungen?status=rejected");
  await club.getByRole("link", { name: title }).click();
  await expect(club.getByText("Bitte Adresse der Halle ergänzen.").first()).toBeVisible();
  await club.getByRole("textbox", { name: "Straße" }).fill("Badstraße 1");
  await club.getByRole("button", { name: "Speichern" }).click();
  await expect(club.getByText("Gespeichert.")).toBeVisible();
  await club.getByRole("button", { name: "Erneut einreichen" }).click();
  await expectStatus(club, "Eingereicht");

  await page.reload();
  await page.getByRole("button", { name: "Freigeben" }).click();
  await page.getByRole("button", { name: "Freigabe bestätigen" }).click();
  await expectStatus(page, "Veröffentlicht");
  await expect(page.getByText("Freigegeben").first()).toBeVisible(); // history

  // club: title and dates locked after publication
  await club.reload();
  await expect(club.getByRole("textbox", { name: "Titel", exact: true }).first()).toBeDisabled();
  await expect(club.locator('input[name="startDate"]')).toBeDisabled();
  await expect(club.getByRole("button", { name: "Entfernung beantragen" })).toBeVisible();
});
