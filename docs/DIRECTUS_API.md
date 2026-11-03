# AI Agent Access to the Local Directus API

AI coding agents may call the **local** Directus instance (Docker, `pnpm stack:up`) directly,
e.g. to inspect collections, verify permissions or test schema changes.

## Where the credentials live

All credentials are in the git-ignored root `.env` file (template: `.env.example`):

| Variable                                           | Purpose                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `DIRECTUS_PUBLIC_URL`                              | Base URL, locally `http://localhost:8055`                             |
| `DIRECTUS_ADMIN_TOKEN`                             | Static token of the bootstrap admin user. **Local development only.** |
| `DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD` | Studio login for the project owner                                    |
| `DIRECTUS_SERVICE_TOKEN`                           | Restricted Fastify service account (created in Phase 1)               |

`ADMIN_TOKEN` is only applied when Directus bootstraps an **empty** database. If you change it
later, update the token on the admin user in Studio (User → Token) or reset the volume with
`docker compose --env-file .env -f infrastructure/compose/compose.yml down -v` (destroys local data).

Never use or request production/test tokens for agent work. Test and production must not set
`DIRECTUS_ADMIN_TOKEN`.

## Usage

```bash
set -a; . ./.env; set +a
curl -s -H "Authorization: Bearer $DIRECTUS_ADMIN_TOKEN" "$DIRECTUS_PUBLIC_URL/collections"
curl -s -H "Authorization: Bearer $DIRECTUS_ADMIN_TOKEN" "$DIRECTUS_PUBLIC_URL/schema/snapshot" > directus/snapshots/snapshot.json
```

Never print token values into logs, docs or commits.

## Rules

- Any schema, role, policy or permission change made via the API must be captured in
  `directus/snapshots/` and documented — the local instance is disposable.
- Application code must not use the admin token; Fastify uses `DIRECTUS_SERVICE_TOKEN`.
