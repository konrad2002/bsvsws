import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests for critical journeys (spec §15.1). They run against the
 * local stack: `pnpm stack:up`, `pnpm directus:apply`, `pnpm directus:seed`,
 * `pnpm dev` (web :3000, api :4000) – emails are read from Mailpit (:8025).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "de-DE",
    trace: "retain-on-failure",
  },
});
