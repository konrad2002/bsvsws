# Documentation Index

| Document                                             | Content                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| [PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md) | Authoritative requirements                                   |
| [02-architecture.md](02-architecture.md)             | Implementation architecture, auth/session design, licence    |
| [03-data-model.md](03-data-model.md)                 | Collections, constraints, invariants, schema change process  |
| [04-authorization.md](04-authorization.md)           | User levels, Directus roles/policies, Fastify rules          |
| [05-workflows.md](05-workflows.md)                   | Invitations, verification, memberships, notifications, audit |
| [06-api-specification.md](06-api-specification.md)   | Fastify endpoints and contracts                              |
| [09-infrastructure.md](09-infrastructure.md)         | Local setup, Docker, Directus setup tooling, CI              |
| [10-testing.md](10-testing.md)                       | Automated tests, test accounts, manual test steps            |
| [decisions/README.md](decisions/README.md)           | Technical decision log                                       |
| [DIRECTUS_API.md](DIRECTUS_API.md)                   | Agent access to the local Directus API                       |

Planned documents (spec §18) — create each when its phase starts, instead of copying the spec:

| Document                                      | Created in |
| --------------------------------------------- | ---------- |
| `07-frontend-specification.md`, `08-ui-ux.md` | Phase 4–5  |

`05-workflows.md` and `06-api-specification.md` are extended with the event workflow in Phase 3.

`01-project-overview.md` and `11-implementation-roadmap.md` are covered by spec §1 and §17;
only split them out if they start to diverge from the spec.
