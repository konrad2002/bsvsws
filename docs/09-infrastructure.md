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
| `tools`    | `infrastructure/docker/tools.Dockerfile` (`directus/tools` + schema snapshot)         | –                      | Deployments only (one-off jobs)    |

All services share one definition file, `infrastructure/compose/compose.yml`. Environment
differences come from env files / deployment secrets, not separate architectures. Published
ports bind to `127.0.0.1`; in deployed environments the existing nginx on the VPS terminates TLS
(see [Deployment](#deployment-phase-8)).

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

| Command                                                             | Effect                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm directus:apply`                                               | Idempotently applies project settings, `directus/snapshots/schema.json`, policies + permissions, roles and the service account (token = `DIRECTUS_SERVICE_TOKEN`). Flags: `--dry-run`, `--allow-destructive` (pass via `pnpm --filter @bsv-sws/directus-tools apply -- --dry-run`). |
| `pnpm directus:snapshot`                                            | Exports the current schema to `directus/snapshots/schema.json`.                                                                                                                                                                                                                     |
| `pnpm directus:seed`                                                | Local-only demo data and test accounts. Refuses non-localhost targets.                                                                                                                                                                                                              |
| `pnpm --filter @bsv-sws/directus-tools migrate:joomla [-- --apply]` | Crawls the old Joomla site and imports news, pages, events, files and legacy redirects ([migration.md](migration.md)). Dry run by default.                                                                                                                                          |

Uses `DIRECTUS_URL` and `DIRECTUS_SETUP_TOKEN` (deployed environments) or `DIRECTUS_ADMIN_TOKEN`
(local). In deployments, run `directus:apply` as an explicit, reviewed step — never automatically
with `--allow-destructive`.

## Images

Web and api images use `turbo prune --docker` multi-stage builds from the repository root
context. The api runtime image contains only production dependencies (`pnpm deploy`); the web
image uses Next.js `output: "standalone"`.

## CI/CD (`.github/workflows/ci.yml`)

| Event                    | Jobs                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Pull request             | format, lint, typecheck, test, build; integration tests (real Directus); build the 4 images (no push) |
| Push to `develop`        | same, then push images to GHCR (tags `<commit sha>`, `develop`) → **deploy to test**                  |
| Push to `master`         | same, then push images (`<commit sha>`, `master`) → **deploy to production**                          |
| Manual: `Directus apply` | `.github/workflows/directus-apply.yml` – dry-run / apply / **destructive** apply for one environment  |
| Weekly: `GHCR cleanup`   | keeps the newest 30 versions per image (private GHCR storage quota)                                   |

A deploy only starts if checks, integration tests and all image builds succeeded. Deploy runs are
never cancelled by newer pushes (only pull-request runs are). A failed deploy step or smoke test
fails the workflow (red run + GitHub notification).

## Deployment (Phase 8)

Owner decisions: isolated stacks per environment; existing nginx on the host; private GHCR
images; Directus Studio on its own subdomain; `directus:apply` runs automatically but
non-destructively.

| Environment              | Branch    | Host / directory                                                       | URLs                                                     | Status                                                                  |
| ------------------------ | --------- | ---------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| test (GitHub env `test`) | `develop` | separate dev host, `/home/konrad/docker/bsv/dev` → stack `bsv-sws-dev` | https://bsv.konrad2002.de, https://bsv-cms.konrad2002.de | active                                                                  |
| production               | `master`  | e.g. `/opt/bsv-sws/production` → `bsv-sws-production`                  | https://bsv-sws.de, https://cms.bsv-sws.de               | not used yet – deploys only with repo variable `DEPLOY_PRODUCTION=true` |

### Layout on the VPS

```text
/home/konrad/docker/bsv/dev/   Compose project bsv-sws-dev         (develop, test environment)
/opt/bsv-sws/production/     Compose project bsv-sws-production  (master, later)
  .env                     secrets of THIS environment (chmod 600, never in git/GitHub)
  image.env                IMAGE_TAG of the last successful deploy (written by deploy.sh)
  compose.yml, compose.deploy.yml, deploy.sh, tools.sh   copied by every deploy
  .docker/                 per-environment registry login, only during a deploy
```

Each stack has its own containers, network, PostgreSQL volume, upload volume and host ports
(e.g. test: web 3100 / Directus 8155, production: web 3000 / Directus 8055 – set in `.env`).
`compose.deploy.yml` overlays `compose.yml`: registry images instead of builds, no source mounts,
only web and Directus published on `127.0.0.1`, log rotation, and the `tools` job.

**nginx as a Docker container** (the dev host): set `PROXY_NETWORK` (the nginx container's network)
and `PROXY_ALIAS` (e.g. `bsv-dev`) in `.env`. `deploy.sh`/`tools.sh` then add
`compose.proxy.yml`: web and Directus join that network as `<alias>-web:3000` and
`<alias>-cms:8055` and publish no host ports; api and postgres stay on the stack's private
network. Find the network with
`docker inspect <nginx-container> --format '{{json .NetworkSettings.Networks}}'`.

If nginx runs as a **Docker Swarm service**, its overlay network must be _attachable_ – otherwise
the deploy fails with "network … not manually attachable" (the flag cannot be added later).
Create a dedicated network and add it to the nginx service (dev host, 2026-11-05):

```bash
docker network create --driver overlay --attachable bsv-proxy
docker service update --network-add bsv-proxy <nginx-service>   # or add it in the nginx stack file
```

and set `PROXY_NETWORK=bsv-proxy`.

### Secrets separation (spec §14.3/§14.4)

| Where                                    | What                                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `<DEPLOY_DIR>/.env` (server only)        | all application secrets: database, Directus secret/admin/setup token, service token, `APP_SECRET`, SMTP, licence key                         |
| GitHub Environment `test` / `production` | secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (deploy key), `VPS_KNOWN_HOSTS`; variables `DEPLOY_DIR`, `WEB_PUBLIC_URL`, optional `VPS_PORT` |
| GitHub job token                         | short-lived GHCR push (CI) / pull (deploy); logged out after each deploy                                                                     |

The deploy job refuses to run if `DEPLOY_DIR` does not match the environment
(directory name `dev`/`test` for `develop`, `production`/`prod` for `master`; the name is also the
stack name `bsv-sws-<name>`), so production can
never be deployed with test settings. Protect the `production` environment with required
reviewers / branch restriction to `master` in the GitHub settings.

### Deploy flow (`infrastructure/scripts/deploy.sh <env-dir> <sha>`)

1. pull the four images of the commit;
2. start `postgres` + `directus`, wait until healthy;
3. `tools apply` – settings, schema snapshot, roles/policies/permissions, service account.
   **Destructive schema diffs abort the deploy** (spec §14.3); the running api/web stay untouched;
4. start `api` + `web` (healthchecks: `/health/ready`, `/api/health`), write `image.env`;
5. smoke test from GitHub: `<WEB_PUBLIC_URL>/api/health` and `/`.

**Destructive schema change** (reviewed): run the workflow _Directus apply_ from the same branch
with mode `dry-run` (inspect), then `destructive`; then re-run the failed deploy job.

**Rollback:** re-run the deploy job of an older successful workflow run, or on the server
`bash deploy.sh <DEPLOY_DIR> <older-sha>` (images of the last 30 builds are kept). Schema
changes are not rolled back automatically.

**Rehearsal:** the whole flow was tested locally with an empty database (`DEPLOY_SKIP_PULL=1`
uses locally built images tagged like the registry), including the dev setup: an nginx
container with `bsv-dev.conf.example` on a shared network, pages/404/Studio via HTTPS and a
browser login (secure cookies, Server Action origin check).

### First-time server setup (per environment)

1. Docker Engine with the Compose plugin ≥ 2.24 installed system-wide (`docker-compose-plugin`
   package – the per-deploy `DOCKER_CONFIG` must still find the plugin). Deploy user in group `docker`.
2. `mkdir -p <DEPLOY_DIR>` (dev: `/home/konrad/docker/bsv/dev`); copy `infrastructure/deployment/env.example` to `.env`, fill
   in **new** secrets (`openssl rand -hex 32`), `chmod 600`. Set `DIRECTUS_ADMIN_TOKEN` before the
   first start – Directus assigns it to the bootstrap admin, the tools job uses it.
3. Deploy key: `ssh-keygen -t ed25519 -f bsv-sws-<env>`; public key into the deploy user's
   `authorized_keys`. GitHub Environment secrets: `VPS_SSH_KEY` (private key), `VPS_HOST`,
   `VPS_USER`, `VPS_KNOWN_HOSTS` = output of `ssh-keyscan [-p <port>] <VPS_HOST>` run against
   **exactly** the `VPS_HOST` value (hostname vs. IP matters; otherwise "Host key verification
   failed"). Variables: `DEPLOY_DIR`, `WEB_PUBLIC_URL`, optional `VPS_PORT` (default 22). The
   workflow checks the SSH connection before copying anything.
4. DNS: `A`/`AAAA` records → host (dev: `bsv.konrad2002.de`, `bsv-cms.konrad2002.de`;
   production: `bsv-sws.de`, `www.bsv-sws.de`, `cms.bsv-sws.de`).
5. nginx: dev → [`bsv-dev.conf.example`](../infrastructure/deployment/nginx/bsv-dev.conf.example)
   (nginx container, Docker DNS `resolver 127.0.0.11`, upstreams `bsv-dev-web:3000` /
   `bsv-dev-cms:8055`, certificate `/etc/nginx/certs/konrad2002.de.{pem,key}`, `noindex`);
   production → [`bsv-sws.conf.example`](../infrastructure/deployment/nginx/bsv-sws.conf.example)
   (adapt domains, ports), get certificates (certbot), `nginx -t && systemctl reload nginx`.
   `X-Forwarded-For` must be **overwritten** with `$remote_addr` (rate limiting uses the first
   entry – not `$proxy_add_x_forwarded_for`), and `Host`/`X-Forwarded-Host` must be `$http_host`
   (Next.js checks it against the browser's `Origin` for Server Actions).
6. Push to the branch (or re-run the workflow) → first deploy creates the database and applies
   the configuration. Then log in to Studio (`cms.<domain>`) with the bootstrap admin, create
   Verband accounts (role _Verband_), and enter the licence key if not set in `.env`.

### SMTP (IONOS)

`SMTP_HOST=smtp.ionos.de`, port 587 with STARTTLS (`SMTP_SECURE=false`) or 465 with
`SMTP_SECURE=true`; user/password of the sending mailbox. `EMAIL_FROM` must be that mailbox (or an
alias IONOS allows), otherwise mails are rejected or land in spam (SPF/DKIM of the domain).
Directus (password reset) and the API use the same settings. Test: invite yourself on the test
environment and check delivery.

### Domains and URLs

| Variable              | Production example       | Used for                                                                  |
| --------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `WEB_PUBLIC_URL`      | `https://bsv-sws.de`     | links in emails, WebCal URLs                                              |
| `DIRECTUS_PUBLIC_URL` | `https://cms.bsv-sws.de` | Directus `PUBLIC_URL` (Studio, password-reset links), Studio links in app |

The test environment uses `https://bsv.konrad2002.de` and `https://bsv-cms.konrad2002.de`
(spec §14.1: other domain than production); both values are set per `.env`.

### Backups (spec §14.5) – deferred by the owner

Not implemented yet (owner decision, 2026-11-04). **Spec §14.5 requires daily PostgreSQL
backups with a tested restore before launch** – see the launch checklist in
[launch.md](launch.md). Data to back up per environment: the `postgres-data` volume (via
`pg_dump`) and the `directus-uploads` volume.
