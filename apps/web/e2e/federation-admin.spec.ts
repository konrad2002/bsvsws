import { expect, test } from "@playwright/test";
import { ADMIN_TOKEN, DIRECTUS, login, SEED_PASSWORD } from "./helpers";

/**
 * Phase 7 journey: federation administration – settings (recipients + representative
 * limit), the limit as seen by a representative, account overview, audit log, and
 * that representatives cannot reach any of it.
 */
const settingsUrl = `${DIRECTUS}/items/notification_settings`;
const adminHeaders = { authorization: `Bearer ${ADMIN_TOKEN}`, "content-type": "application/json" };
let original: Record<string, unknown> = {};

test.describe.configure({ mode: "serial" });
test.skip(!SEED_PASSWORD || !ADMIN_TOKEN, "needs DEV_SEED_PASSWORD and DIRECTUS_ADMIN_TOKEN");

test.beforeAll(async () => {
  const res = await fetch(settingsUrl, { headers: adminHeaders });
  const data = ((await res.json()) as { data: Record<string, unknown> }).data;
  original = {
    representative_joined_recipients: data.representative_joined_recipients,
    event_review_recipients: data.event_review_recipients,
    max_representatives_per_club: data.max_representatives_per_club ?? null,
  };
});

test.afterAll(async () => {
  await fetch(settingsUrl, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify(original),
  });
});

test("federation configures recipients and a representative limit", async ({ page }) => {
  await login(page, "verband@example.com", SEED_PASSWORD);
  const nav = page.getByRole("navigation", { name: "Interne Navigation" });
  await nav.getByRole("link", { name: "Einstellungen", exact: true }).click();

  const review = page.getByRole("textbox", {
    name: "Eingereichte Veranstaltungen und Entfernungsanträge",
  });
  const before = await review.inputValue();
  await review.fill(`${before}\nkeine-adresse`);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Bitte eine gültige E-Mail-Adresse angeben.")).toBeVisible();

  await review.fill(`${before}\nPruefung-E2E@Example.com`);
  await page.getByRole("spinbutton", { name: "Höchstzahl Vereinsvertreter pro Verein" }).fill("1");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Einstellungen gespeichert.")).toBeVisible();
  await page.reload();
  await expect(review).toHaveValue(/pruefung-e2e@example\.com/);

  // the change is audited
  await nav.getByRole("link", { name: "Protokoll", exact: true }).click();
  await page.getByRole("combobox", { name: "Bereich" }).selectOption("settings");
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page).toHaveURL(/bereich=settings/);
  await expect(page.getByText("Einstellungen geändert").first()).toBeVisible();
});

test("the limit stops representatives from appointing more representatives", async ({ page }) => {
  await login(page, "vertreter@example.com", SEED_PASSWORD);
  const nav = page.getByRole("navigation", { name: "Interne Navigation" });
  await expect(nav.getByRole("link", { name: "Einstellungen" })).toHaveCount(0);
  await nav.getByRole("link", { name: "Mitglieder", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "mitglied@example.com" });
  await row.getByRole("button", { name: "Zum Vertreter machen" }).click();
  await expect(page.getByText(/höchstens 1 Vereinsvertreter/)).toBeVisible();

  // direct URLs of the administration stay closed
  for (const path of [
    "/intern/verband/einstellungen",
    "/intern/verband/benutzer",
    "/intern/verband/protokoll",
  ]) {
    await page.goto(path);
    await expect(page.getByText("Dieser Bereich ist für dich nicht freigegeben.")).toBeVisible();
  }
});

test("federation finds accounts and their clubs", async ({ page }) => {
  await login(page, "verband@example.com", SEED_PASSWORD);
  await page
    .getByRole("navigation", { name: "Interne Navigation" })
    .getByRole("link", { name: "Benutzerkonten", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Suche (Name oder E-Mail)" })
    .fill("mitglied@example.com");
  await page.getByRole("button", { name: "Suchen" }).click();
  const row = page.getByRole("row").filter({ hasText: "mitglied@example.com" });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("cell", { name: "Verein", exact: true })).toBeVisible();
  await row.getByRole("link", { name: /\(Mitglied\)$/ }).click();
  await expect(page).toHaveURL(/\/intern\/verband\/vereine\/[0-9a-f-]{36}$/);

  // dashboard links to content administration in Directus
  await page.goto("/intern");
  await expect(page.getByRole("link", { name: "News ↗" })).toHaveAttribute(
    "href",
    /\/admin\/content\/articles$/,
  );
});
