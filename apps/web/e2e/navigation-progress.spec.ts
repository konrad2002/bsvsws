import { expect, test } from "@playwright/test";

/**
 * On a slow connection a client-side navigation shows the progress bar until the
 * new page is rendered (no setup data needed).
 */
test("shows a progress bar while a slow navigation is pending", async ({ page }) => {
  await page.goto("/login");
  const bar = page.locator(".nav-progress");
  await expect(bar).not.toHaveAttribute("data-loading");

  // Delay the RSC payload of the next navigation (simulated bad connection).
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      if (route.request().headers()["rsc"]) await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    },
  );
  await page.getByRole("link", { name: /^Startseite –/ }).click();

  await expect(bar).toHaveAttribute("data-loading", "true");
  await expect(bar).toHaveCSS("opacity", "1");
  await expect(page).toHaveURL(/\/$/);
  await expect(bar).not.toHaveAttribute("data-loading");
});
