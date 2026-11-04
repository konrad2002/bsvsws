# Frontend Specification

Pages, layouts and frontend behaviour of `apps/web` (Next.js 16, App Router). Visual design is
still a functional placeholder (spec §9.5) – structure and behaviour are binding, styling is not.

## Layouts

| Route group         | Layout                                                                               | Notes                                             |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `(public)`          | Public header + navigation (placeholder until Phase 5's database-managed navigation) | SSR, no session needed                            |
| `(internal)/intern` | Public header + role-dependent sub-navigation (sidebar on desktop, row on mobile)    | Requires login (proxy redirect + `requireUser()`) |

## Public routes

| Route                                                                                  | Content                                                                                      |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/`                                                                                    | Home (placeholder, Phase 5)                                                                  |
| `/veranstaltungen`                                                                     | Event calendar: list (default), month and year view, filters, WebCal subscriptions           |
| `/veranstaltungen/<slug>`                                                              | Public event detail (published events only, otherwise 404)                                   |
| `/kalender/<feed>.ics`                                                                 | WebCal feeds: `alle`, `schwimmen`, `wasserball`, `synchronschwimmen`, `masters`, `allgemein` |
| `/login`, `/einladung/<token>`                                                         | Login, invitation acceptance / registration                                                  |
| `/api/clubs/:id/logo`, `/api/events/:id/files/:fileId`, `/api/events/:id/images/:kind` | Asset proxies                                                                                |

### Event calendar URL parameters (`/veranstaltungen`)

| Parameter   | Values                                           | Default            |
| ----------- | ------------------------------------------------ | ------------------ |
| `ansicht`   | `liste`, `monat`, `jahr`                         | `liste`            |
| `monat`     | `YYYY-MM` (month view)                           | current month      |
| `jahr`      | `YYYY` (year view)                               | current year       |
| `zeitraum`  | `vergangen` (list: last 12 months, newest first) | upcoming 12 months |
| `kalender`  | feed slug (`schwimmen`, …)                       | all                |
| `verein`    | club slug                                        | all                |
| `kategorie` | category slug                                    | all                |

- Filters are a plain GET form (works without JavaScript) and combine freely; view switches and
  month/year navigation keep the active filters.
- Month view: 7-column grid (Monday first) on ≥ md screens, list of days with events on mobile
  (spec §9.4). Multi-day events appear on every day; the start time is shown on the first day.
- Year view: 12 month cards with the events starting in or running into that month; month titles
  link to the month view.
- "Heute" = current date in Europe/Berlin.
- The club filter refers to the event's **owning club**.

### Public event detail

Shows title, date/time, calendar and categories, organizer, venue/address, website, results
service, description, admission info, schedule (with day for multi-day events), files
(downloads), further notes, title image and logo. Internal fields (status, review comments,
people) are never part of the public API response.

## Internal routes (`/intern`)

| Route                                         | Who                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `/intern`                                     | every logged-in user (overview: level, club)                         |
| `/intern/verein`, `/intern/verein/mitglieder` | club members / representatives                                       |
| `/intern/veranstaltungen`, `/neu`, `/<id>`    | representatives (own club), federation (all, archive)                |
| `/intern/verband/pruefung`                    | federation – review list ("Prüfung (n)" indicator in the navigation) |
| `/intern/verband/vereine`, `/<id>`            | federation – club administration                                     |

## Rendering

Public pages are **server-side rendered on every request** (no data cache), so changes to
published events and CMS content are visible immediately (spec §7.9). Request-dependent parts sit
inside `<Suspense>` (Cache Components). If traffic ever requires it, add `use cache` with
on-demand invalidation – not needed now.

**HTTP status codes:** a streamed response is fixed at 200, and in production the prerendered
shell (Partial Prerendering) is always streamed – a `notFound()` in the page cannot change that.
Therefore **Proxy** (`src/proxy.ts`) resolves content paths before rendering via the fast API
call `GET /public/resolve` (detail routes and the CMS catch-all; only full page loads, not client
navigations):

- legacy URL in the redirect table → real **307/308**;
- missing/unpublished content → Proxy renders the page once internally (regular not-found UI with
  full layout; loop guard header `x-bsv-render-404`) and returns it with a real **404** – needed
  so link checkers can find broken links during the migration;
- API unreachable → fail open (normal rendering; 200 + `noindex` for missing content).

The detail pages additionally load their data at the top level (`instant = false`) as fallback.

## Conventions

- German UI labels; dates `TT.MM.JJJJ`, times `HH:MM Uhr` (`lib/format.ts`).
- Forms: server actions + `useActionState`; field errors from Fastify are shown per field.
- Accessibility: labelled controls, sections with `aria-labelledby`, `aria-current` for active
  view, screen-reader dates in the month grid.
