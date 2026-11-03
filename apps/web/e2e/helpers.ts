import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
export const DIRECTUS = process.env.DIRECTUS_URL ?? "http://localhost:8055";
export const SEED_PASSWORD = process.env.DEV_SEED_PASSWORD ?? "";
export const ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN ?? "";

interface MailSummary {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  Created: string;
}

/** Waits for the newest email to `to` whose subject matches, created after `since`. */
export async function waitForMail(to: string, subject: RegExp, since: Date) {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await res.json()) as { messages: MailSummary[] };
    const hit = messages.find((m) => subject.test(m.Subject) && new Date(m.Created) >= since);
    if (hit) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)).json()) as {
        Subject: string;
        Text: string;
      };
      return full;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No mail to ${to} matching ${subject}`);
}

export async function login(page: Page, email: string, password: string, next = "/intern") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("textbox", { name: "E-Mail-Adresse", exact: true }).fill(email);
  await page.locator('input[name="password"]:visible').fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((url) => url.pathname === next);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Abmelden" }).click();
  await page.waitForURL("/");
}

/** Register + verify through the invitation page; returns after the login notice. */
export async function registerViaInvitation(
  page: Page,
  link: string,
  email: string,
  password: string,
  name: [string, string],
) {
  const since = new Date(Date.now() - 1000);
  await page.goto(link);
  await page.getByRole("textbox", { name: "Vorname", exact: true }).fill(name[0]);
  await page.getByRole("textbox", { name: "Nachname", exact: true }).fill(name[1]);
  await page.locator('input[name="password"]:visible').fill(password);
  await page.locator('input[name="passwordRepeat"]:visible').fill(password);
  await page.getByRole("button", { name: "Registrieren" }).click();
  await expect(page.getByRole("heading", { name: "E-Mail-Adresse bestätigen" })).toBeVisible();
  const mail = await waitForMail(email, /Bestätigungscode/, since);
  const code = /\b(\d{6})\b/.exec(mail.Subject)![1]!;
  await page.getByRole("textbox", { name: "Bestätigungscode", exact: true }).fill(code);
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await page.waitForURL(/\/login\?registriert=1/);
  await expect(page.getByText("Dein Konto ist bestätigt")).toBeVisible();
}

/** Test cleanup via the Directus admin API (local only). */
export async function adminCleanup(clubName: string, emails: string[]) {
  const h = { authorization: `Bearer ${ADMIN_TOKEN}`, "content-type": "application/json" };
  const get = async (path: string) =>
    (
      (await (await fetch(`${DIRECTUS}${path}`, { headers: h })).json()) as {
        data: { id: string | number }[];
      }
    ).data;
  const del = (path: string, ids: (string | number)[]) =>
    ids.length
      ? fetch(`${DIRECTUS}${path}`, { method: "DELETE", headers: h, body: JSON.stringify(ids) })
      : null;
  const clubs = await get(
    `/items/clubs?filter[name][_eq]=${encodeURIComponent(clubName)}&fields=id`,
  );
  for (const { id } of clubs) {
    await del(
      "/items/club_memberships",
      (await get(`/items/club_memberships?filter[club][_eq]=${id}&fields=id&limit=-1`)).map(
        (r) => r.id,
      ),
    );
    await del(
      "/items/invitations",
      (await get(`/items/invitations?filter[club][_eq]=${id}&fields=id&limit=-1`)).map((r) => r.id),
    );
    await del(
      "/items/audit_logs",
      (await get(`/items/audit_logs?filter[club][_eq]=${id}&fields=id&limit=-1`)).map((r) => r.id),
    );
    await del("/items/clubs", [id]);
  }
  const users = await get(
    `/users?filter[email][_in]=${emails.map(encodeURIComponent).join(",")}&fields=id`,
  );
  await del(
    "/users",
    users.map((u) => u.id),
  );
}
