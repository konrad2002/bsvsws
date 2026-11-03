# Data Model

Source of truth: [`directus/snapshots/schema.json`](../directus/snapshots/schema.json).
TypeScript view: [`packages/directus/src/schema.ts`](../packages/directus/src/schema.ts).
Requirements: spec §4, §5, §6, §12.

All primary keys are UUIDs except `audit_logs.id` (auto-increment). `date_created`/`date_updated`
are maintained by Directus.

## Phase 1 collections

### `directus_users` (system, extended)

| Field                                                            | Notes                      |
| ---------------------------------------------------------------- | -------------------------- |
| `first_name`, `last_name`, `email`, `password`, `status`, `role` | Directus built-ins         |
| `phone`                                                          | Custom, optional (spec Q6) |

`role` is the **account role** (Verband / Benutzer / Administrator); see
[04-authorization.md](04-authorization.md). Member vs. representative is not stored on the user.

### `clubs`

| Field                           | Type                                                            | Notes                                            |
| ------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| `active`                        | boolean, default true                                           | Archive flag; inactive clubs are hidden publicly |
| `name`                          | string, **unique**, required                                    |                                                  |
| `short_name`                    | string                                                          |                                                  |
| `slug`                          | string, **unique**, required                                    | URL segment of the club page                     |
| `logo`                          | file (M2O `directus_files`, set null)                           |                                                  |
| `description`                   | rich text (HTML)                                                |                                                  |
| `website`, `email`, `phone`     | string                                                          | Public contact data                              |
| `street`, `postal_code`, `city` | string                                                          |                                                  |
| `sports`                        | csv of `swimming`, `water_polo`, `artistic_swimming`, `masters` | `SPORTS` in `packages/shared`                    |
| `venue`                         | text                                                            | Training venue(s)                                |

Clubs exist independently of representatives (spec §6.3).

### `club_memberships`

| Field                                                      | Type                                     | Notes                                                             |
| ---------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `user`                                                     | M2O `directus_users`, required, restrict |                                                                   |
| `club`                                                     | M2O `clubs`, required, restrict          |                                                                   |
| `role`                                                     | `member` \| `representative`             | Membership role (spec §4.2)                                       |
| `status`                                                   | `active` \| `ended`                      | Ended rows are kept as history                                    |
| `active_user`                                              | uuid, **unique**, nullable, hidden       | **Invariant:** `= user` while `status = active`, otherwise `NULL` |
| `started_at`                                               | timestamp, required                      |                                                                   |
| `ended_at`, `end_reason` (`removed` \| `left`), `ended_by` |                                          | Set when ending a membership                                      |
| `invitation`                                               | M2O `invitations`, **unique**, nullable  | Invitation the membership came from                               |
| `created_by`                                               | M2O `directus_users`                     | Actor who granted it                                              |

**Why `active_user`:** the unique index enforces "at most one active club membership per user"
(spec §4.2, §5.3) in the database, even for concurrent requests, without a partial index (which
would need a Directus extension; decision: no extensions). PostgreSQL allows many `NULL`s, so
ended memberships don't conflict. Every write that changes `status` must set/clear
`active_user` accordingly — do this only in the Fastify membership service.

### `invitations`

| Field                        | Type                                 | Notes                                                                       |
| ---------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| `token_hash`                 | string, **unique**, required, hidden | SHA-256 of the secret token; plaintext is never stored (spec §5.2)          |
| `email`                      | string, required, indexed            | Target email                                                                |
| `club`                       | M2O `clubs`, required                |                                                                             |
| `membership_role`            | `member` \| `representative`         |                                                                             |
| `status`                     | `pending` \| `accepted` \| `revoked` | "Expired" = `pending` and `expires_at` in the past (derived, no job needed) |
| `expires_at`                 | timestamp, required                  | Configurable validity (Phase 2)                                             |
| `issued_by`                  | M2O `directus_users`, required       |                                                                             |
| `accepted_at`, `accepted_by` |                                      |                                                                             |
| `revoked_at`, `revoked_by`   |                                      |                                                                             |

**Atomic acceptance (Phase 2):** create the membership with a nested update of its
`invitation` (`{ invitation: { id, status: "accepted", … } }`) in **one** Directus request.
Directus runs nested relational writes in a single transaction, and the unique
`club_memberships.invitation` and `active_user` constraints make a second acceptance or a second
active membership fail at the database level.

### `audit_logs`

| Field                      | Type                              | Notes                                                          |
| -------------------------- | --------------------------------- | -------------------------------------------------------------- |
| `timestamp`                | timestamp (date-created), indexed |                                                                |
| `actor`                    | M2O `directus_users`, set null    | Original user, not the service account                         |
| `action`                   | string, indexed                   | Dot notation, e.g. `invitation.created`, `membership.promoted` |
| `entity_type`, `entity_id` | string (entity_id indexed)        |                                                                |
| `club`                     | M2O `clubs`, set null             | Context                                                        |
| `changes`                  | json `{ before, after }`          |                                                                |
| `comment`                  | text                              | Reason / comment                                               |
| `context`                  | json                              | Further context (e.g. event id)                                |

Append-only: no role has update/delete permissions (administrators excepted by Directus design).

## Changing the schema

1. Change the schema in your **local** Directus (Studio or API).
2. `pnpm directus:snapshot` → commit `directus/snapshots/schema.json`.
3. Update `packages/directus/src/schema.ts`, this document and permissions in
   `directus/tools/src/access.ts` if needed.
4. Verify on a clean instance: `docker compose … down -v`, `pnpm stack:up`, `pnpm directus:apply`.

`pnpm directus:apply` refuses to delete collections, fields or relations unless
`--allow-destructive` is passed; it never runs destructive changes implicitly (spec §14.3).
Snapshots are version-bound: after a Directus upgrade, re-export the snapshot.
