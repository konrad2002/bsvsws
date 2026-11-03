# Directus

- `extensions/` — custom Directus extensions. Copied into the image
  (`infrastructure/docker/directus.Dockerfile`) and live-mounted in local Compose.
- `snapshots/` — version-controlled schema snapshots (`/schema/snapshot`). Apply with
  `/schema/diff` + `/schema/apply` or `npx directus schema apply`. Never auto-apply destructive
  changes during deployment (spec §14.3).
- `seed/` — minimal seed data/scripts for local development and tests only (fixed calendars,
  initial categories, etc.).

Roles, policies and permissions must be reproducible too; document them in `docs/04-authorization.md`.
