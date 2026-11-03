# Authorization

Requirements: spec §3.4–3.5, §4, §8.4. Fastify is authoritative for sensitive workflows;
Directus permissions are a second layer.

## User levels

The five levels of spec §4.1 are **derived**, never stored (`deriveUserLevel` in
`packages/shared`):

| Level                 | Derived from                                                                       |
| --------------------- | ---------------------------------------------------------------------------------- |
| `administrator`       | Directus `admin_access` (any admin role)                                           |
| `federation`          | Directus role **Verband**                                                          |
| `club_representative` | Role **Benutzer** + active membership with `role = representative`                 |
| `club_member`         | Role **Benutzer** + active membership with `role = member`                         |
| `visitor`             | Not logged in, or role Benutzer without active membership (e.g. removed from club) |

Account privileges win over memberships: a federation user with a club membership is
`federation`. Accounts with any other role (e.g. the service account) are rejected by Fastify.

## Directus roles and policies

Defined in [`directus/tools/src/access.ts`](../directus/tools/src/access.ts); fixed IDs in
[`packages/directus/src/ids.ts`](../packages/directus/src/ids.ts).

| Role                     | Policies                 | Studio        | Purpose                                                        |
| ------------------------ | ------------------------ | ------------- | -------------------------------------------------------------- |
| Administrator (built-in) | Administrator (built-in) | full          | System administration                                          |
| **Verband**              | Verband – Studio         | yes (limited) | Federation users                                               |
| **Benutzer**             | – (none)                 | no            | Club members and representatives; act only via Next.js/Fastify |
| **API-Service**          | API-Servicekonto         | no            | Fastify service account only                                   |

### Permissions

| Collection         | Public     | Verband – Studio | API-Servicekonto     |
| ------------------ | ---------- | ---------------- | -------------------- |
| `clubs`            | read (all) | read             | read, create, update |
| `club_memberships` | –          | read             | read, create, update |
| `invitations`      | –          | read             | read, create, update |
| `audit_logs`       | –          | read             | read, create         |
| `directus_users`   | –          | read             | read                 |

- Federation users can **look at** workflow data in Studio, but all changes go through the
  application so that business rules and the audit log apply. Content collections (news,
  pages, navigation) get Studio write access in Phase 5.
- Nobody except administrators can update or delete audit logs, and nobody can delete
  memberships or invitations (history is kept by status changes).
- The Benutzer role has no Directus permissions. `/users/me` still returns the user ID, which is
  all token verification needs.

### Licence constraint

Row filters and field restrictions ("custom permission rules") require a Directus licence (we use
the OIG). Without it, Directus rejects such rules on create and ignores them on read. Therefore
**all permissions are unrestricted** (all fields, no filter); `assertNoCustomRules` in
`directus/tools` enforces this. Consequences:

- `pnpm directus:apply` works identically on licensed and unlicensed instances (verified).
- Directus always conceals `password`/`token`; `invitations.token_hash` is only a hash of a
  256-bit random token, so read access to it in Studio is harmless.
- Public reads cannot be filtered in Directus: only collections whose rows are all public may
  get public read access (clubs: Next.js filters `active = true`). Protected content
  (Phase 5/6) is therefore read through a permission-enforcing backend path.
- Studio seats depend on the licence (Core: 3 incl. administrators; every Verband user counts).

## Business authorization (Fastify)

[`apps/api/src/modules/auth/authorization.ts`](../apps/api/src/modules/auth/authorization.ts)
contains the rules as pure functions. Club context **always** comes from the authenticated
user's active membership, never from request input.

| Function                            | Rule                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `isFederation`                      | federation or administrator                                              |
| `isRepresentativeOf(ctx, club)`     | active membership in that club with role representative                  |
| `canManageClub(ctx, club)`          | federation, or representative of that club                               |
| `canInvite(ctx, club, role)`        | `representative` invitations: federation only; `member`: `canManageClub` |
| `canManageMembershipsOf(ctx, club)` | `canManageClub` (promote, demote, remove)                                |
| `canAccessVisibility(ctx, level)`   | spec §8.4 matrix via `canSeeVisibility`                                  |
| `authorize(cond)`                   | throws `403 FORBIDDEN`                                                   |

Every sensitive route: `const ctx = await auth.authenticate(request.headers.authorization)`,
then `authorize(canX(ctx, …))`, then the domain service. The frontend may use `SessionUser` to
hide UI, never as a security decision.
