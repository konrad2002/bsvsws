# AGENTS.md

Instructions for AI coding agents (Claude Code, GitHub Copilot, …) working in this repository.

**Project:** Replacement of the Joomla website of the Bezirksschwimmverband Südwestsachsen
(BSV-SWS, https://bsv-sws.de/) with one central website: public site, invitation-only internal
area for clubs, and federation administration.

## Source of truth

[docs/PROJECT_SPECIFICATION.md](docs/PROJECT_SPECIFICATION.md) is authoritative. Do not
re-derive requirements from memory — read the sections relevant to your task:

| Topic                                                                         | Spec section |
| ----------------------------------------------------------------------------- | ------------ |
| Component responsibilities, data access paths, auth & service-account rule    | §3           |
| Roles, memberships, promotion/demotion, audit log                             | §4           |
| Invitations & registration                                                    | §5           |
| Clubs                                                                         | §6           |
| Events: fields, calendars, statuses, approval, locked fields, removal, WebCal | §7           |
| News, pages, 4 visibility levels, protected files                             | §8           |
| Navigation, layouts, design direction, URLs, rendering                        | §9           |
| Email, security, rate limiting                                                | §10–11       |
| Directus data model, schema changes                                           | §12          |
| API design                                                                    | §13          |
| Infrastructure, CI/CD, backups                                                | §14          |
| Testing strategy                                                              | §15          |
| Changes that **require project-owner approval**                               | §16.2        |
| Phased roadmap with acceptance criteria                                       | §17          |
| Open technical decisions (to be documented when decided)                      | §19          |
| Q&A decision record                                                           | §20          |

Implementation docs (read before touching the area): [docs/README.md](docs/README.md) (index),
[02-architecture](docs/02-architecture.md) (auth/session design, Directus licence),
[03-data-model](docs/03-data-model.md), [04-authorization](docs/04-authorization.md),
[09-infrastructure](docs/09-infrastructure.md), [10-testing](docs/10-testing.md),
[decisions](docs/decisions/README.md), [DIRECTUS_API](docs/DIRECTUS_API.md) (agent access to local Directus).

## Current status

Phases 0 (foundation) and 1 (Directus schema: clubs, memberships, invitations, audit log;
roles/policies; login/session; Fastify auth + authorization rules) are done. **Next: Phase 2** —
clubs, invitations and memberships workflows. Do not start later phases prematurely. Keep this
section current.

## Repository map

```text
apps/web            Next.js 16 (App Router) – public site + internal area. Route groups:
                    src/app/(public) and src/app/(internal)/intern keep layouts separate.
apps/api            Fastify 5 – sensitive workflows & app authorization.
                    Thin routes in src/routes, business logic in src/modules/<domain>.
packages/shared     Framework-free constants/types (roles, statuses, calendars, labels).
packages/validation Zod schemas shared by web and api.
packages/directus   Typed Directus SDK client factories + DirectusSchema type.
packages/ui         Reusable shadcn/ui components and design tokens (source-only, no layouts).
directus/           snapshots/schema.json (schema source of truth), extensions/ (unused by decision),
                    tools/ (@bsv-sws/directus-tools: apply schema + roles/policies/permissions
                    from src/access.ts, snapshot export, local seed).
infrastructure/     docker/ (Dockerfiles), compose/ (shared compose file), scripts/, deployment/.
docs/               Specification and technical documentation.
```

## Commands (run from repo root)

```bash
cp .env.example .env     # first time; then set real local secrets
pnpm install
pnpm stack:up            # postgres + directus in Docker (Directus on http://localhost:8055)
pnpm directus:apply      # apply settings, schema snapshot, roles/policies/permissions, service account
pnpm directus:seed       # local test club + accounts (see docs/10-testing.md)
pnpm directus:snapshot   # after schema changes: export snapshot, then commit it
pnpm dev                 # web :3000 + api :4000 on the host, packages in watch mode
pnpm lint | pnpm typecheck | pnpm test | pnpm build | pnpm format
pnpm stack:up:app        # full stack incl. web/api images (production-like)
pnpm stack:down
pnpm --filter @bsv-sws/api test   # single package
```

Run `pnpm lint && pnpm typecheck && pnpm test` before declaring work done (CI runs these plus
`format:check` and `build`).

## Non-negotiable rules

1. **Only Directus touches PostgreSQL.** Fastify uses the Directus SDK/API, never SQL or a DB driver.
2. **Directus is the only auth provider.** No Auth.js/Clerk/etc. Tokens stay server-side
   (HTTP-only cookies); privileged Directus tokens never reach the browser.
3. **Authorization is enforced in Fastify** for every sensitive request, based on the _original
   user's_ identity — never on the service account's Directus permissions. Hiding UI is not security.
4. Club users (members, representatives) never get Directus Studio access.
5. Protected pages/files must enforce visibility on direct requests, not just in navigation.
6. Ask before anything listed in spec §16.2 (stack, auth, role/membership model, event
   workflow, deployment architecture, data relationships, new paid services). If a requirement
   is ambiguous, ask a focused question instead of inventing behavior.

## Conventions

- **Language:** website content and UI labels German; code, identifiers, collection names,
  role ids, docs and comments English.
- **Naming:** packages `@bsv-sws/<name>`; ESM everywhere; library imports use `.js` suffixes (NodeNext).
- **Validation:** Zod for all external input (env, requests). Define schemas once in
  `packages/validation` when both web and api need them.
- **Constants:** fixed system concepts (roles, statuses, calendars, visibility levels) live in
  `packages/shared` — reuse, don't redefine.
- **Business logic** stays out of React components and out of Fastify route handlers.
  Keep state transitions explicit and unit-testable. Send emails only after success; avoid duplicates on retry.
- **UI:** follow the existing bsv-sws.de identity; do not invent colors/typography (spec §9.5).
  Add shadcn components to `packages/ui` (`components.json` is configured there).
- **Next.js 16 differs from older versions** — consult `apps/web/AGENTS.md` and
  `node_modules/next/dist/docs/` before writing Next code.
- **TypeScript is pinned to `~6.0`** because typescript-eslint does not support TS 7 yet.
- **Directus schema** changes must be reproducible: export with `pnpm directus:snapshot`, put
  access changes in `directus/tools/src/access.ts`, update `packages/directus/src/schema.ts` and
  `docs/03-data-model.md`. Never change production schema by hand. No Directus extensions
  (owner decision) — use unique constraints and nested (transactional) writes instead.
- **Directus licence:** custom permission rules (row/field restrictions) are licence-gated, so
  all Directus permissions stay unrestricted (enforced by `assertNoCustomRules`); fine-grained
  rules belong in Fastify (`docs/04-authorization.md`).
- **Auth in Fastify:** `auth.authenticate(request.headers.authorization)` → `AuthContext`, then
  `authorize(canX(ctx, …))` from `src/modules/auth/authorization.ts`. Club context comes from
  `ctx.membership`, never from request input. Errors: `AppError` helpers in `src/lib/errors.ts`.
- **Next.js data access:** server-only; call Fastify via `apiFetch()` and get the user via
  `getCurrentUser()`/`requireUser()`. Session reads must sit inside `<Suspense>` (Cache Components).
- **Tests:** Vitest, colocated as `*.test.ts`. Prioritise authorization boundaries, membership,
  invitations and event state transitions (spec §15). Skip trivial presentation tests.
- **Docs:** update affected docs in the same change; record non-trivial technical decisions
  (especially §19 open items) in `docs/decisions/README.md`.
- **Secrets:** never commit `.env` files or tokens. Add new variables to `.env.example` with
  safe placeholders.

## Git workflow

`master` → production, `develop` → test, feature branches (`feature/<topic>`) for work, merged
via reviewed PRs. Commit only when asked.

## Reporting

When finishing a task, report changed files, important decisions, tests run and remaining
limitations (spec §21).
