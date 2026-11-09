# Directus

- `extensions/` — custom Directus extensions (currently none; owner decision: no extensions). Copied into the image
  (`infrastructure/docker/directus.Dockerfile`) and live-mounted in local Compose.
- `snapshots/` — version-controlled schema snapshots (`/schema/snapshot`). Applied by
  `pnpm directus:apply`. Never auto-apply destructive
  changes during deployment (spec §14.3).
- `tools/` — `@bsv-sws/directus-tools`: `pnpm directus:apply` (settings, schema snapshot,
  roles/policies/permissions from `tools/src/access.ts`, service account), `pnpm directus:snapshot`,
  `pnpm directus:seed` (local demo data). See `docs/09-infrastructure.md`.

Roles, policies and permissions are defined in `tools/src/access.ts` and documented in
`docs/04-authorization.md`.
