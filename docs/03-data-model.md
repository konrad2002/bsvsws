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
| `registered_user`            | M2O `directus_users`, set null       | Unverified account created during registration (Phase 2)                    |
| `verification_code_hash`     | string, hidden                       | HMAC-SHA256 (`APP_SECRET`, invitation id) of the current 6-digit code       |
| `verification_expires_at`    | timestamp                            | Code validity (15 min)                                                      |
| `verification_attempts`      | integer, default 0                   | Wrong attempts for the current code (max. 5)                                |
| `email_sent_at`              | timestamp                            | Last successful invitation email (empty = link only shared manually)        |

**Atomic acceptance** (implemented in Phase 2, see [05-workflows.md](05-workflows.md)): create the membership with a nested update of its
`invitation` (`{ invitation: { id, status: "accepted", … } }`) in **one** Directus request.
Directus runs nested relational writes in a single transaction, and the unique
`club_memberships.invitation` and `active_user` constraints make a second acceptance or a second
active membership fail at the database level.

### `notification_settings` (singleton)

The single row is created by `directus:apply` (Directus would otherwise create singleton rows lazily, and concurrent first writes produce duplicates).

| Field                              | Type       | Notes                                                                                                                    |
| ---------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| `representative_joined_recipients` | csv (tags) | Emails notified when a new representative joins (spec §5.7). Independent of permissions; edited by federation in Studio. |
| `event_review_recipients`          | csv (tags) | Emails notified about submitted events and removal requests (spec §10.3). Grants no review rights.                       |

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

## Phase 3 collections (events)

### `events`

| Field                                                                 | Type                                                                        | Notes                                                                             |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `status`                                                              | `draft` \| `pending` \| `published` \| `rejected` \| `unpublished`          | Changed only by Fastify workflow actions                                          |
| `title`                                                               | string, required                                                            | Locked for clubs after publication                                                |
| `description`, `admission_info`, `additional_info`                    | text                                                                        | Plain text (line breaks kept)                                                     |
| `start_date`, `end_date`                                              | date, required                                                              | One record for multi-day events (spec §7.3); locked for clubs after publication   |
| `all_day`, `start_time`, `end_time`                                   | boolean, time                                                               | Times cleared when all-day                                                        |
| `calendar`                                                            | `swimming` \| `water_polo` \| `artistic_swimming` \| `masters` \| `general` | Exactly one fixed calendar (no collection, spec §7.4)                             |
| `club`                                                                | M2O `clubs`, nullable                                                       | **Owning** club (who manages it); `NULL` = federation event                       |
| `organizer_type`, `organizer_name`                                    | `club` \| `federation` \| `external`, string                                | Organizer may differ from owner (e.g. external organizer of a club-managed event) |
| `official`                                                            | boolean                                                                     | Federation only; default true for federation events                               |
| `venue`, `street`, `postal_code`, `city`, `website`                   | string                                                                      |                                                                                   |
| `title_image`, `logo`                                                 | file                                                                        | Served via Fastify (published = public)                                           |
| `results_service`, `swimresults_id`                                   | string                                                                      | SwimResults integration postponed (spec §7.2)                                     |
| `categories`                                                          | M2M → `event_categories` (junction `events_event_categories`)               | 0..n                                                                              |
| `schedule`                                                            | O2M → `event_schedule_entries`                                              | Replaced via nested write (`one_deselect_action = delete`)                        |
| `files`                                                               | O2M → `event_files`                                                         |                                                                                   |
| `removal_requests`                                                    | O2M → `event_removal_requests`                                              | Used for atomic decisions                                                         |
| `created_by`, `submitted_by/_at`, `reviewed_by/_at`, `review_comment` |                                                                             | Review metadata; `review_comment` = last rejection reason                         |
| `published_at`                                                        | timestamp                                                                   | **First** publication (decides whether a club may discard)                        |
| `deleted_at`, `deleted_by`                                            |                                                                             | Soft delete (archive)                                                             |

### `event_categories`

`id` (int), `name` (unique), `slug` (unique), `active` (archive flag – deactivate instead of
delete), `sort`. Base data (Wettkampf, Kampfrichter, Verband) is inserted by `directus:apply` if
missing; existing entries are never overwritten.

### `event_schedule_entries`

`event`, `date` (optional, multi-day), `time`, `end_time`, `type` (`admission`, `warm_up`,
`meeting`, `session`, `break`, `awards`, `custom` – `SCHEDULE_ENTRY_TYPES`), `title`,
`description`, `sort`.

### `event_files`

`event`, `file` (M2O `directus_files`), `description` (required), `sort`. Removing an attachment
deletes this row; the Directus file remains.

### `event_removal_requests` (spec §19.3)

`event`, `type` (`unpublish` \| `delete`), `reason`, `status` (`pending` \| `approved` \|
`rejected`), `pending_event` (**unique**, = event while pending → max. one open request per event),
`requested_by`, `decided_by/_at`, `decision_comment`. Requests are never deleted (history).

Event history is not a separate collection: it is read from `audit_logs`
(`entity_type = events`) – see [05-workflows.md](05-workflows.md#event-history-spec-194).

> Directus returns `bigInteger` primary keys (e.g. `audit_logs.id`) as **strings**.

## Phase 5 collections (CMS)

### `articles`

`status` (`draft` \| `published` \| `archived`), `published_at` (required, default now; future =
scheduled), `title`, `slug` (**unique**), `category` (M2O `article_categories`, **required** –
exactly one), `teaser`, `content` (WYSIWYG HTML, uploads → public media folder),
`featured_image`, `author` (M2O users, optional), `author_name` (optional override),
`user_created`, timestamps.

### `article_categories`

`name` (unique), `slug` (unique), `active` (archive flag), `sort`.

### `pages`

`status` (`draft` \| `published`), `visibility` (`public` \| `club` \| `club_representative` \|
`federation`), `title`, `slug` (unique per parent – enforced at read time, first by sort wins),
`parent` (M2O self; O2M alias `children`), `content` (WYSIWYG HTML, uploads → folder
"Seitendokumente"), `sort`. The **effective** visibility of a page is the strictest level along
its path (a child is never more visible than its parent).

### `navigation_items`

`menu` (`main` \| `footer` \| `internal`), `label`, `parent` (M2O self, cascade; alias `children`), `link_type`
(`page` \| `article` \| `route` \| `url` \| `none`), `page`, `article`, `route`, `url`,
`visibility`, `open_in_new_tab`, `active`, `sort`.

### `redirects`

`from_path` (**unique**, may include a query), `to_path`, `permanent`, `active`, `note`.

### Directus file folders

Both have fixed ids (`DIRECTUS_FOLDER_IDS`) and are created by `directus:apply`.

| Folder               | Id constant     | Served via `/medien/<id>`                                                                  |
| -------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| "Öffentliche Medien" | `publicMedia`   | always public (news images, page images meant for everyone)                                |
| "Seitendokumente"    | `pageDocuments` | Phase 6: visible exactly like the **published** pages/articles whose content references it |

Files in any other folder (event files, logos, …) are never served by `/medien`.

## Studio organisation

Collections are grouped into Studio folders (schema-less "alias" collections): **Kalender**
(`calendar`, events and their child collections), **Inhalte** (`content`: news, categories,
navigation, pages, redirects) and **Vereine** (`club`: clubs, memberships, invitations);
`audit_logs` and `notification_settings` stay at the top level. Folder membership, colours, icons,
order and German translations are collection metadata and therefore part of
`directus/snapshots/schema.json` – `pnpm directus:apply` reproduces them in every environment.

## Changing the schema

1. Change the schema in your **local** Directus (Studio or API) – this includes Studio
   organisation such as folders, colours, sort order and translations.
2. `pnpm directus:snapshot` → commit `directus/snapshots/schema.json`.
3. Update `packages/directus/src/schema.ts`, this document and permissions in
   `directus/tools/src/access.ts` if needed.
4. Verify on a clean instance: `docker compose … down -v`, `pnpm stack:up`, `pnpm directus:apply`.

`pnpm directus:apply` refuses to delete collections, fields or relations unless
`--allow-destructive` is passed; it never runs destructive changes implicitly (spec §14.3).
Snapshots are version-bound: after a Directus upgrade, re-export the snapshot.
