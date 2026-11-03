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
