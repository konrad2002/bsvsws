# Testing

Strategy: spec §15. Vitest everywhere, tests colocated as `*.test.ts`.

```bash
pnpm test                                        # unit tests, all packages (no services needed)
pnpm --filter @bsv-sws/api test:integration      # API against the real local Directus
pnpm --filter @bsv-sws/web test:e2e              # browser journeys (Playwright) against the dev stack
```

Prerequisites for integration and E2E: `pnpm stack:up`, `pnpm directus:apply`,
`pnpm directus:seed`; E2E additionally `pnpm dev` and once `pnpm --filter @bsv-sws/web exec
playwright install chromium`. Both clean up the data they create (admin API).
CI runs unit tests and the integration tests (Directus as a service container, unlicensed).

## What exists

| Area                            | File                                              | Covers                                                                                                                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User levels & visibility matrix | `packages/shared/src/roles.test.ts`               | `deriveUserLevel`, spec §8.4 matrix                                                                                                                                                                                                                                          |
| Authorization boundaries        | `apps/api/src/modules/auth/authorization.test.ts` | Representative vs. other club, member vs. representative actions, federation-only, invitations, visibility                                                                                                                                                                   |
| Authentication                  | `apps/api/src/modules/auth/auth-service.test.ts`  | Bearer parsing, invalid tokens, role mapping, suspended users, service account rejected, caching                                                                                                                                                                             |
| API contract                    | `apps/api/src/app.test.ts`                        | Health, `/me`, uniform error bodies (Fastify `inject`, fake identity provider)                                                                                                                                                                                               |
| Session helpers                 | `apps/web/src/lib/**/*.test.ts`                   | Token expiry/refresh decision, login rate limiter, open-redirect protection                                                                                                                                                                                                  |
| Business rules                  | `apps/api/src/modules/*/…-rules.test.ts`          | Invitation status/single use, membership changes (self-change rule, other club, members), club field restrictions                                                                                                                                                            |
| Crypto                          | `apps/api/src/lib/crypto.test.ts`                 | Tokens, codes, HMAC binding                                                                                                                                                                                                                                                  |
| Shared schemas                  | `packages/validation/src/validation.test.ts`      | Normalisation, URL/email/slug/token/code validation                                                                                                                                                                                                                          |
| Access config                   | `directus/tools/src/access.test.ts`               | No custom rules in base permissions, hardening, no deletes                                                                                                                                                                                                                   |
| **Integration (real Directus)** | `apps/api/test/integration/phase2.int.test.ts`    | Club creation, invitations (email + manual link), registration + code verification, single use, one active membership, email mismatch, revoke, promote/demote/self-rule, field restrictions, logo upload/public delivery, removal keeps account + re-join, audit log entries |
| **E2E (browser)**               | `apps/web/e2e/club-onboarding.spec.ts`            | Federation creates club → invites representative by email → registration with code from Mailpit → login; representative invites member by link → member joins → promote → remove                                                                                             |
| Schema tooling                  | `directus/tools/src/schema-diff.test.ts`          | Destructive-change detection                                                                                                                                                                                                                                                 |

Unit tests never need a running Directus (Fastify's identity lookup sits behind the
`IdentityProvider` port, mailer is replaceable). Integration tests use a fake mailer to read
links and codes; E2E tests read real emails from Mailpit's API.

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

## Manual test: clubs, invitations, memberships (Phase 2)

1. As `verband@example.com`: "Vereine verwalten" → create a club → on its page invite a
   **Vereinsvertreter** with "per E-Mail senden".
2. Open http://localhost:8025, open the invitation mail, follow the link (private window).
3. Register → a mail with a 6-digit code arrives → enter it (try a wrong code first: remaining
   attempts are shown) → login page shows "Dein Konto ist bestätigt" → log in → /intern shows
   the club as Vereinsvertreter. If `representative_joined_recipients` is set in Studio
   (Benachrichtigungen), that address got a mail.
4. As the new representative: "Mein Verein" → edit data, upload a logo (PNG/JPEG/WebP). Name and
   URL are not editable. "Mitglieder" → invite a member **without** email → copy the link →
   register in another browser → representative receives "Neues Mitglied".
5. Promote the member, demote again; your own row has no buttons. Remove the member → they stay
   able to log in but see "Keine Vereinszugehörigkeit".
6. Open a used or revoked link → appropriate message. Invite `mitglied@example.com` (already in
   SV Musterstadt) to another club → accepting fails with "bereits Mitglied eines anderen Vereins".
7. Studio → Auditlog shows all actions with the acting user.
