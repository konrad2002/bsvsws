# Infrastructure

Covers local development, Docker images, Compose and CI. Requirements: spec §14.

## Services

| Service    | Image                                                                                 | Port (local)           | Notes                              |
| ---------- | ------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------- |
| `mailpit`  | `axllent/mailpit:v1.32` (profile `dev`, local only)                                   | 8025 (UI), 1025 (SMTP) | Catches all email                  |
| `postgres` | `postgres:17-alpine`                                                                  | not published          | Only Directus connects (spec §3.1) |
| `directus` | `infrastructure/docker/directus.Dockerfile` (Directus 12.6.0 + `directus/extensions`) | 8055                   | CMS, auth, files                   |
| `api`      | `infrastructure/docker/api.Dockerfile`                                                | 4000                   | Compose profile `app`              |
| `web`      | `infrastructure/docker/web.Dockerfile` (Next.js standalone)                           | 3000                   | Compose profile `app`              |

All services share one definition file, `infrastructure/compose/compose.yml`. Environment
differences come from env files / deployment secrets, not separate architectures. Published
ports bind to `127.0.0.1`; in deployed environments a reverse proxy (to be defined in Phase 8)
terminates TLS.

## Local development

```bash
cp .env.example .env        # replace placeholder secrets (e.g. openssl rand -hex 32)
pnpm install
pnpm stack:up               # postgres + directus
pnpm directus:apply         # settings, schema, roles/policies/permissions, service account
pnpm directus:seed          # optional: demo club + test accounts (docs/10-testing.md)
pnpm dev                    # web + api on the host with hot reload
```

- Directus Studio: http://localhost:8055 (login with `DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD`).
- Mailpit (dev profile, started by `pnpm stack:up`): all outgoing email lands at
  http://localhost:8025. The API on the host uses `SMTP_HOST=localhost:1025`; containers use
  `DIRECTUS_SMTP_HOST=mailpit`. Deployed environments don't start the `dev` profile and set the
  IONOS SMTP variables instead.
- Directus licence (Open Innovation Grant): set `DIRECTUS_LICENSE_KEY`, or enter the key once in
  Studio (stored in the local database). The OIG allows up to 5 activations (local, test,
  production, …). Without it the instance runs on the restricted Core tier
  ([02-architecture.md](02-architecture.md#directus-licence)).
- API health: http://localhost:4000/health, readiness incl. Directus: `/health/ready`.
- The api reads the root `.env` (`tsx --env-file-if-exists`); Next.js reads `apps/web/.env.local`
  if present and otherwise uses defaults pointing at localhost.
- `pnpm stack:up:app` builds and runs web and api images as well (production-like check).
- Uploads and database live in named Docker volumes (`postgres-data`, `directus-uploads`).

## Directus configuration tooling (`directus/tools`)

| Command                  | Effect                                                                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm directus:apply`    | Idempotently applies project settings, `directus/snapshots/schema.json`, policies + permissions, roles and the service account (token = `DIRECTUS_SERVICE_TOKEN`). Flags: `--dry-run`, `--allow-destructive` (pass via `pnpm --filter @bsv-sws/directus-tools apply -- --dry-run`). |
| `pnpm directus:snapshot` | Exports the current schema to `directus/snapshots/schema.json`.                                                                                                                                                                                                                     |
| `pnpm directus:seed`     | Local-only demo data and test accounts. Refuses non-localhost targets.                                                                                                                                                                                                              |

Uses `DIRECTUS_URL` and `DIRECTUS_SETUP_TOKEN` (deployed environments) or `DIRECTUS_ADMIN_TOKEN`
(local). In deployments, run `directus:apply` as an explicit, reviewed step — never automatically
with `--allow-destructive`.

## Images

Web and api images use `turbo prune --docker` multi-stage builds from the repository root
context. The api runtime image contains only production dependencies (`pnpm deploy`); the web
image uses Next.js `output: "standalone"`.

## CI (`.github/workflows/ci.yml`)

On pushes to `master`/`develop` and on pull requests: install, `format:check`, lint, typecheck,
test, build, then build all three Docker images (not pushed).

## Not yet defined (Phase 8)

- Image registry and publishing, deployment of `develop` → test and `master` → production.
- VPS layout, reverse proxy/TLS, domains.
- Daily PostgreSQL backups, retention, restore procedure (spec §14.5) — scripts go into
  `infrastructure/scripts/`, deployment config into `infrastructure/deployment/`.
