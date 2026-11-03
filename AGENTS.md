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

Other docs: [docs/README.md](docs/README.md) (index), [docs/09-infrastructure.md](docs/09-infrastructure.md)
(local setup, Docker, CI), [docs/decisions/](docs/decisions/README.md) (decision log),
[docs/DIRECTUS_API.md](docs/DIRECTUS_API.md) (agent access to local Directus).

## Current status

Phase 0 (repository foundation) is in place. **Next: Phase 1** — Directus schema and
authentication foundation. Do not start later phases prematurely. Keep this section current.

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
directus/           extensions/ (baked into image), snapshots/ (schema), seed/ (minimal seed).
infrastructure/     docker/ (Dockerfiles), compose/ (shared compose file), scripts/, deployment/.
docs/               Specification and technical documentation.
```

## Commands (run from repo root)

```bash
cp .env.example .env     # first time; then set real local secrets
pnpm install
pnpm stack:up            # postgres + directus in Docker (Directus on http://localhost:8055)
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
- **Directus schema** changes must be reproducible: commit snapshots to `directus/snapshots/`
  and document the model in docs. Never change production schema by hand.
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
