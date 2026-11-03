# Infrastructure

Covers local development, Docker images, Compose and CI. Requirements: spec §14.

## Services

| Service    | Image                                                                                 | Port (local)  | Notes                              |
| ---------- | ------------------------------------------------------------------------------------- | ------------- | ---------------------------------- |
| `postgres` | `postgres:17-alpine`                                                                  | not published | Only Directus connects (spec §3.1) |
| `directus` | `infrastructure/docker/directus.Dockerfile` (Directus 12.6.0 + `directus/extensions`) | 8055          | CMS, auth, files                   |
| `api`      | `infrastructure/docker/api.Dockerfile`                                                | 4000          | Compose profile `app`              |
| `web`      | `infrastructure/docker/web.Dockerfile` (Next.js standalone)                           | 3000          | Compose profile `app`              |

All services share one definition file, `infrastructure/compose/compose.yml`. Environment
differences come from env files / deployment secrets, not separate architectures. Published
ports bind to `127.0.0.1`; in deployed environments a reverse proxy (to be defined in Phase 8)
terminates TLS.

## Local development

```bash
cp .env.example .env        # replace placeholder secrets (e.g. openssl rand -hex 32)
pnpm install
pnpm stack:up               # postgres + directus
pnpm dev                    # web + api on the host with hot reload
```

- Directus Studio: http://localhost:8055 (login with `DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD`).
- API health: http://localhost:4000/health, readiness incl. Directus: `/health/ready`.
- The api reads the root `.env` (`tsx --env-file-if-exists`); Next.js reads `apps/web/.env.local`
  if present and otherwise uses defaults pointing at localhost.
- `pnpm stack:up:app` builds and runs web and api images as well (production-like check).
- Uploads and database live in named Docker volumes (`postgres-data`, `directus-uploads`).

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
