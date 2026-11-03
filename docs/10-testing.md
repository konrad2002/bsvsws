# Testing

Strategy: spec §15. Vitest everywhere, tests colocated as `*.test.ts`.

```bash
pnpm test                              # all packages
pnpm --filter @bsv-sws/api test        # one package
```

## What exists

| Area                            | File                                              | Covers                                                                                                     |
| ------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| User levels & visibility matrix | `packages/shared/src/roles.test.ts`               | `deriveUserLevel`, spec §8.4 matrix                                                                        |
| Authorization boundaries        | `apps/api/src/modules/auth/authorization.test.ts` | Representative vs. other club, member vs. representative actions, federation-only, invitations, visibility |
| Authentication                  | `apps/api/src/modules/auth/auth-service.test.ts`  | Bearer parsing, invalid tokens, role mapping, suspended users, service account rejected, caching           |
| API contract                    | `apps/api/src/app.test.ts`                        | Health, `/me`, uniform error bodies (Fastify `inject`, fake identity provider)                             |
| Session helpers                 | `apps/web/src/lib/**/*.test.ts`                   | Token expiry/refresh decision, login rate limiter, open-redirect protection                                |
| Schema tooling                  | `directus/tools/src/schema-diff.test.ts`          | Destructive-change detection                                                                               |

Unit tests never need a running Directus: Fastify's Directus access sits behind the
`IdentityProvider` port, which tests replace with a fake. Integration tests against a real
Directus (invitation acceptance, membership transitions) follow in Phase 2.

## Local test accounts

`pnpm directus:seed` (local Directus only) creates the club **SV Musterstadt e. V.** and:

| Email                   | Level                             |
| ----------------------- | --------------------------------- |
| `verband@example.com`   | Verband                           |
| `vertreter@example.com` | Vereinsvertreter (SV Musterstadt) |
| `mitglied@example.com`  | Verein (SV Musterstadt)           |

Password: `DEV_SEED_PASSWORD` from your `.env`. Administrator: `DIRECTUS_ADMIN_EMAIL` /
`DIRECTUS_ADMIN_PASSWORD`.

## Manual test: authentication (Phase 1)

With `pnpm stack:up`, `pnpm directus:apply`, `pnpm directus:seed`, `pnpm dev`:

1. Open http://localhost:3000/intern → redirected to `/login?next=/intern`.
2. Wrong password → "Anmeldung fehlgeschlagen …", no cookies set.
3. Log in as each test account → `/intern` shows email, Benutzerebene and Verein matching the
   table above.
4. Browser dev tools: `bsv_access` / `bsv_refresh` are `HttpOnly`; no token in JS/localStorage.
5. Delete only the `bsv_access` cookie and reload → still logged in (token refreshed).
6. "Abmelden" → back on `/`; `/intern` redirects to login again.
7. Six failed logins for the same email → "Zu viele Anmeldeversuche …".
8. Suspend a test user in Directus Studio → their next `/intern` load ends the session.
