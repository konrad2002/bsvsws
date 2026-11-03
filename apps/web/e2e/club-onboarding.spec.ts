import { expect, test } from "@playwright/test";
import {
  adminCleanup,
  login,
  logout,
  registerViaInvitation,
  SEED_PASSWORD,
  waitForMail,
} from "./helpers";

/**
 * Critical journeys (spec §15.1): invitation → registration → membership, and a
 * representative managing club members. Runs the real stack incl. emails.
 */
const run = Math.random().toString(36).slice(2, 8);
const clubName = `E2E Verein ${run}`;
const repEmail = `e2e-rep-${run}@example.com`;
const memberEmail = `e2e-member-${run}@example.com`;
const password = `E2e-${run}-passwort`;

test.describe.configure({ mode: "serial" });
test.skip(
  !SEED_PASSWORD || !process.env.DIRECTUS_ADMIN_TOKEN,
  "needs DEV_SEED_PASSWORD and DIRECTUS_ADMIN_TOKEN",
);
test.afterAll(async () => adminCleanup(clubName, [repEmail, memberEmail]));

test("federation creates a club and invites the initial representative, who registers", async ({
  page,
  browser,
}) => {
  await login(page, "verband@example.com", SEED_PASSWORD);
  await page.getByRole("link", { name: "Vereine verwalten" }).click();
  await page.getByRole("textbox", { name: "Vereinsname", exact: true }).fill(clubName);
  await page
    .getByRole("textbox", { name: "URL-Kürzel (Slug)", exact: true })
    .fill(`e2e-verein-${run}`);
  await page.getByRole("button", { name: "Verein anlegen" }).click();
  await expect(page.getByRole("heading", { name: clubName })).toBeVisible();
  await expect(page.getByText("noch keinen Vereinsvertreter")).toBeVisible();

  const since = new Date(Date.now() - 1000);
  await page.getByRole("textbox", { name: "E-Mail-Adresse", exact: true }).fill(repEmail);
  await page.getByRole("combobox", { name: "Rolle" }).selectOption("representative");
  await page.getByRole("button", { name: "Einladen" }).click();
  await expect(page.getByText(`Einladung für ${repEmail}`)).toBeVisible();

  const mail = await waitForMail(repEmail, /Vereinsvertreter/, since);
  const link = /(http\S+\/einladung\/[A-Za-z0-9_-]{43})/.exec(mail.Text)![1]!;

  const invitee = await (await browser.newContext()).newPage();
  await registerViaInvitation(invitee, link, repEmail, password, ["Rita", "E2E"]);
  await login(invitee, repEmail, password);
  await expect(invitee.getByText("Vereinsvertreter").first()).toBeVisible();
  await expect(invitee.getByText(clubName)).toBeVisible();
});

test("representative invites a member by link, then promotes and removes them", async ({
  page,
  browser,
}) => {
  await login(page, repEmail, password);
  await page.getByRole("link", { name: "Mitglieder" }).click();
  await expect(page.getByRole("combobox", { name: "Rolle" }).locator("option")).toHaveCount(1); // no representative invites
  await page.getByRole("textbox", { name: "E-Mail-Adresse", exact: true }).fill(memberEmail);
  await page.getByRole("checkbox", { name: "per E-Mail senden" }).uncheck();
  await page.getByRole("button", { name: "Einladen" }).click();
  const link = (await page.locator("code").textContent())!;
  expect(link).toMatch(/\/einladung\/[A-Za-z0-9_-]{43}$/);

  const invitee = await (await browser.newContext()).newPage();
  await registerViaInvitation(invitee, link, memberEmail, password, ["Max", "E2E"]);
  await waitForMail(repEmail, /Neues Mitglied/, new Date(Date.now() - 60_000));
  await login(invitee, memberEmail, password);
  await expect(invitee.getByText("Verein", { exact: true }).first()).toBeVisible();
  await expect(invitee.getByRole("link", { name: "Mitglieder" })).toHaveCount(0);

  await page.reload();
  const members = page.getByRole("region", { name: "Mitglieder" });
  const row = members.getByRole("row", { name: new RegExp(memberEmail) });
  await row.getByRole("button", { name: "Zum Vertreter machen" }).click();
  await expect(row.getByText("Vereinsvertreter")).toBeVisible();
  // no self-management for the representative
  await expect(members.getByRole("row", { name: /\(du\)/ }).getByRole("button")).toHaveCount(0);

  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Entfernen" }).click();
  await expect(members.getByRole("row", { name: new RegExp(memberEmail) })).toHaveCount(0);

  await invitee.goto("/intern");
  await expect(invitee.getByText("Keine Vereinszugehörigkeit")).toBeVisible();
  await logout(invitee);
});
