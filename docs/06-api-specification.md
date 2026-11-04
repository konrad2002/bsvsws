# API Specification (Fastify)

Base URL: `API_URL` (internal; called only by the Next.js server). JSON bodies, camelCase.
Errors: `{ "error": { "code", "message", "details?" } }` — `message` is German and displayable;
`VALIDATION_ERROR` carries `details.fieldErrors`. Authentication: `Authorization: Bearer
<Directus access token>` (see [02-architecture.md](02-architecture.md)). Rate limits are per
client IP (`x-client-ip`, set by Next.js) and route; exceeding them → `429 RATE_LIMITED`.

Common errors: `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `400 VALIDATION_ERROR`.

## Identity

| Method & path                      | Auth | Response      | Notes                                  |
| ---------------------------------- | ---- | ------------- | -------------------------------------- |
| `GET /me`                          | user | `SessionUser` | level, account role, active membership |
| `GET /health`, `GET /health/ready` | –    | status        | readiness includes Directus            |

## Clubs

| Method & path                     | Authorization                                                                | Request → Response                                                        | Errors / side effects                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /clubs`                      | federation                                                                   | → `Club[]` (incl. inactive)                                               |                                                                                                |
| `POST /clubs`                     | federation                                                                   | `ClubCreateInput` → `201 Club`                                            | `409 NAME_TAKEN`, `409 SLUG_TAKEN`; audit `club.created`                                       |
| `GET /clubs/:clubId`              | federation, any member of the club                                           | → `Club`                                                                  |                                                                                                |
| `PATCH /clubs/:clubId`            | federation (all fields); representative of the club (not `name/slug/active`) | `ClubUpdateInput` (partial, strict) → `Club`                              | `403 FIELDS_NOT_ALLOWED` (`details.fields`), `409 …_TAKEN`; audit `club.updated`               |
| `PUT /clubs/:clubId/logo`         | `canManageClub`                                                              | multipart `file` (PNG/JPEG/WebP ≤ 2 MB) → `Club`                          | `400 INVALID_FILE_TYPE`, `413`; audit `club.logo_changed`                                      |
| `DELETE /clubs/:clubId/logo`      | `canManageClub`                                                              | → `Club`                                                                  | audit `club.logo_changed`                                                                      |
| `GET /clubs/:clubId/logo`         | **public**                                                                   | → image                                                                   | `404` if none; `cache-control: public, max-age=300`                                            |
| `GET /clubs/:clubId/members`      | `canManageClub`                                                              | → `ClubMember[]` (active)                                                 |                                                                                                |
| `GET /clubs/:clubId/invitations`  | `canManageClub`                                                              | → `InvitationSummary[]` (latest 100)                                      |                                                                                                |
| `POST /clubs/:clubId/invitations` | `canInvite(role)`                                                            | `{ email, role, sendEmail=true }` → `201 { invitation, link, emailSent }` | `409 INVITATION_EXISTS`, `409 ALREADY_MEMBER_OF_CLUB`; email; audit `invitation.created`; 30/h |

## Memberships

| Method & path             | Authorization                                          | Request → Response        | Errors / side effects                                                                    |
| ------------------------- | ------------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------- |
| `PATCH /memberships/:id`  | `canManageMembershipsOf`, not self (except federation) | `{ role }` → `ClubMember` | `403 SELF_CHANGE_NOT_ALLOWED`, `409 ROLE_UNCHANGED`; audit `membership.promoted/demoted` |
| `DELETE /memberships/:id` | same                                                   | → `204`                   | membership ended, account kept; audit `membership.removed`                               |

## Invitations

| Method & path                                   | Auth        | Request → Response                                                                                               | Errors / side effects                                                                                                                                                                                                |
| ----------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /invitations/:id/resend`                  | `canInvite` | `{ sendEmail=true }` → `{ invitation, link, emailSent }`                                                         | rotates token, resets expiry; `409 INVITATION_NOT_PENDING`; audit `invitation.resent`; 20/h                                                                                                                          |
| `POST /invitations/:id/revoke`                  | `canInvite` | → `InvitationSummary`                                                                                            | `409 INVITATION_NOT_PENDING`; audit `invitation.revoked`                                                                                                                                                             |
| `GET /invitations/by-token/:token`              | public      | → `PublicInvitation` (`status`: valid/expired/accepted/revoked/invalid, `accountExists`, `awaitingVerification`) | 60/15 min                                                                                                                                                                                                            |
| `POST /invitations/by-token/:token/register`    | public      | `{ firstName, lastName, password, phone? }` → `202`                                                              | creates unverified user, emails code; `409 ACCOUNT_EXISTS`, `409 ACCOUNT_UNAVAILABLE`, `410 INVITATION_EXPIRED/REVOKED`, `409 INVITATION_USED`, `502 EMAIL_FAILED`; 5/15 min per token                               |
| `POST /invitations/by-token/:token/resend-code` | public      | → `202`                                                                                                          | new code, attempts reset; `400 NOT_AWAITING_VERIFICATION`; 3/15 min                                                                                                                                                  |
| `POST /invitations/by-token/:token/verify`      | public      | `{ code }` → `{ email }`                                                                                         | `400 INVALID_CODE` (`details.remainingAttempts`), `400 CODE_EXPIRED`, `429 CODE_LOCKED`; activates user, accepts atomically, notifies; audit `user.verified`, `invitation.accepted`, `membership.created`; 10/15 min |
| `POST /invitations/by-token/:token/accept`      | user        | → `204`                                                                                                          | `403 EMAIL_MISMATCH`, `409 ALREADY_MEMBER`; accepts atomically, notifies, audits                                                                                                                                     |

Schemas: `packages/validation` (`clubs.ts`, `memberships.ts`, `auth.ts`).

## Events

All routes require a user unless marked public. Authorization: `event-rules.ts`
(`allowedActions`), visibility failures return `404`. Detail responses include
`allowedActions`, `lockedFields` and `updatedAt` (review version).

| Method & path                       | Who                                                                    | Request → Response                                                                     | Errors / side effects                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /event-categories`             | user                                                                   | → active categories                                                                    |                                                                                                     |
| `GET /events?status&clubId&deleted` | representatives (own club), federation (all; `deleted=true` = archive) | → `EventSummary[]`                                                                     |                                                                                                     |
| `GET /events/review`                | federation                                                             | → `{ pendingEvents, pendingRemovals }`                                                 |                                                                                                     |
| `POST /events`                      | representative, federation                                             | `EventCreateInput` → `201 EventDetail` (draft)                                         | `403 FIELDS_NOT_ALLOWED`, `400 VALIDATION_ERROR` (cross-field rules), `400 INVALID_CATEGORY`; audit |
| `GET /events/:id`                   | visibility rules                                                       | → `EventDetail`                                                                        |                                                                                                     |
| `PATCH /events/:id`                 | `edit`                                                                 | `EventUpdateInput` (partial, strict; `categoryIds`/`schedule` replace) → `EventDetail` | `403 LOCKED_FIELDS` (`details.fields`), `403 FIELDS_NOT_ALLOWED`; audit `event.updated`             |
| `DELETE /events/:id`                | `discard` (club) / `delete` (federation)                               | `{ comment? }` → `204`                                                                 | soft delete; audit                                                                                  |
| `GET /events/:id/history`           | owning representatives, federation                                     | → `EventHistoryEntry[]`                                                                |                                                                                                     |
| `POST /events/:id/submit`           | `submit`                                                               | → `EventDetail`                                                                        | `409 INVALID_STATUS`; email review recipients                                                       |
| `POST /events/:id/approve`          | federation                                                             | `{ version, comment? }` → `EventDetail`                                                | `409 EVENT_CHANGED`; email submitter                                                                |
| `POST /events/:id/reject`           | federation                                                             | `{ version, comment }` → `EventDetail`                                                 | `409 EVENT_CHANGED`; email submitter                                                                |
| `POST /events/:id/publish`          | federation                                                             | `{ comment? }` → `EventDetail`                                                         |                                                                                                     |
| `POST /events/:id/unpublish`        | federation                                                             | `{ comment? }` → `EventDetail`                                                         |                                                                                                     |
| `POST /events/:id/removal-request`  | owning representative                                                  | `{ type: unpublish\|delete, reason }` → `EventDetail`                                  | `409 REMOVAL_PENDING`; email review recipients                                                      |
| `POST /events/:id/removal-decision` | federation                                                             | `{ approve, comment? }` → `EventDetail`                                                | email requester                                                                                     |
| `POST /events/:id/files`            | `edit`                                                                 | multipart: `description` field **before** `file` → `201 EventDetail`                   | `400 INVALID_FILE_TYPE`, `413`                                                                      |
| `PATCH /events/:id/files/:fileId`   | `edit`                                                                 | `{ description }` → `EventDetail`                                                      |                                                                                                     |
| `DELETE /events/:id/files/:fileId`  | `edit`                                                                 | → `EventDetail`                                                                        |                                                                                                     |
| `GET /events/:id/files/:fileId`     | public if published, else viewers                                      | → file (attachment)                                                                    | `404`                                                                                               |
| `PUT /events/:id/images/:kind`      | `edit`                                                                 | multipart `file` (`kind` = `title_image`\|`logo`) → `EventDetail`                      |                                                                                                     |
| `DELETE /events/:id/images/:kind`   | `edit`                                                                 | → `EventDetail`                                                                        |                                                                                                     |
| `GET /events/:id/images/:kind`      | public if published, else viewers                                      | → image                                                                                |                                                                                                     |

Common workflow errors: `409 INVALID_STATUS` (action not possible in this status), `403` (no role
for the action), `404` (event not visible).

## Public calendar (no authentication)

Only **published, non-deleted** events with a slug; response fields are a whitelist (no workflow
or personal data). Rate limit per client IP.

| Method & path                                       | Request → Response                                                                                                  | Notes                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /public/events?from&to&calendar&club&category` | dates `YYYY-MM-DD` (range ≤ 400 days), calendar key, club slug, category slug → `PublicEventSummary[]`              | events overlapping the range, sorted by start; 120/min                           |
| `GET /public/events/:slug`                          | → `PublicEventDetail`                                                                                               | `404` for unknown/unpublished/deleted; 120/min                                   |
| `GET /public/calendar-filters`                      | → `{ categories, clubs }` (active only)                                                                             | 120/min                                                                          |
| `GET /public/calendar/:feed.ics`                    | `feed` = `alle` \| `schwimmen` \| `wasserball` \| `synchronschwimmen` \| `masters` \| `allgemein` → `text/calendar` | past 12 months + all future events; `cache-control: public, max-age=900`; 60/min |

## Public content (no authentication, Phase 5)

| Method & path                                  | Response                                                      | Notes                                                 |
| ---------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| `GET /public/navigation`                       | `{ main: NavItem[], footer: NavItem[] }`                      | visible tree for visitors                             |
| `GET /public/pages?path=/verband/vorstand`     | `PublicPage` (sanitized `contentHtml`, breadcrumbs, children) | `404` if missing/unpublished/not public               |
| `GET /public/articles?category&page&pageSize`  | `{ items, page, pageCount, total }`                           | published and due only, newest first, `pageSize ≤ 50` |
| `GET /public/articles/:slug`                   | `ArticleDetail`                                               | `404` for drafts, archived, scheduled                 |
| `GET /public/article-categories`               | `{ name, slug }[]`                                            | active only                                           |
| `GET /public/clubs`, `GET /public/clubs/:slug` | `PublicClub[]`, `PublicClubDetail`                            | active clubs only                                     |
| `GET /public/redirects?path&query`             | `{ to, permanent }`                                           | `404` if none                                         |

## Internal content and files (Phase 6)

| Method & path                       | Auth     | Response                                                    | Notes                                                                                                                              |
| ----------------------------------- | -------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /internal/navigation`          | required | `{ main, footer, internal }` for the user's level           | `401` without login                                                                                                                |
| `GET /internal/pages?path=`         | required | `PublicPage` incl. `href`, effective `visibility`           | `403` (no details) if the level is insufficient, `404` if missing/unpublished                                                      |
| `GET /internal/pages/resolve?path=` | required | `{ action: ok \| forbidden \| not_found \| redirect, to? }` | used by the web proxy for real status codes; public pages → `redirect` (permanent) to the public URL                               |
| `GET /content/files/:fileId?width`  | optional | file                                                        | `fileAccess()` reference rule; `401`/`403`/`404`; `Cache-Control: public, max-age=3600` for public files, else `private, no-store` |

`GET /public/pages` breadcrumbs and children are `{ title, href }`; `GET /public/resolve` returns
a `redirect` to `/intern/seiten/<path>` for protected pages. `GET /public/media/:fileId` was
replaced by `/content/files/:fileId`.
