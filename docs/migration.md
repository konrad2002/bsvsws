# Migration of the old Joomla site

Owner decision (Phase 8): content is taken from the **public** website by crawling it. Internal
Joomla content (behind the Joomla login) is not reachable and has to be moved by hand.

Tool: [`directus/tools/src/migrate-joomla.ts`](../directus/tools/src/migrate-joomla.ts), parsers
in [`directus/tools/src/joomla/parse.ts`](../directus/tools/src/joomla/parse.ts) (unit-tested
against saved pages of bsv-sws.de).

## What it does

| Old site                                               | New site                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| News `/news/<alias>`                                   | `articles`, same URL, published, original date and author, category _Allgemein_; a short first paragraph becomes the teaser                                                                                                                                                                                    |
| Pages (`/verband/vorstand`, …)                         | `pages`, same URL. Fills the placeholder base pages; creates missing ones (e.g. `/links`, **not** added to the navigation). Home intro → `startseite`. Embedded Joomla modules (news flash, latest events – the old home page consists only of these) are dropped; the new home renders news and events itself |
| JEvents `/kalender/eventdetail/<id>/…`                 | published **federation** events (`/veranstaltungen/<date>-<title>`) + **308 redirect** from every old URL                                                                                                                                                                                                      |
| Images/downloads under `/images/…`                     | Directus files: news → "Öffentliche Medien", pages/event files → "Seitendokumente"; links rewritten to `/medien/<id>`                                                                                                                                                                                          |
| Home banner photo                                      | `homepage.hero_image` ("Öffentliche Medien"), only if no image is set                                                                                                                                                                                                                                          |
| `/news?start=10` etc.                                  | redirect to the list page                                                                                                                                                                                                                                                                                      |
| `/news`, `/veranstaltungen`, `/sportarten`, `/verband` | served by the new site (app pages / existing pages)                                                                                                                                                                                                                                                            |

Event details: dates/times from the JEvents summary, venue/address from the "Ort:" block,
SwimResults ID from `app.swimresults.de/m/<ID>` links, description as plain text (external file
links kept as "Label: URL"), files hosted on the old server become event files. Calendar and
categories are guessed from the title (_Bezirkstag_ → Allgemein/Verband, otherwise
Schwimmen/Wettkampf) – review them after the import.

**Idempotent:** re-runs skip existing articles (slug), events (title + start date), pages that
already have real content, files (`description = joomla:<path>`) and redirects. Edits made in
Studio after the import are never overwritten.

## Running it

Run against **test** first, review, then production. The crawl must happen while the old site is
still reachable – **before the DNS switch** (or set `JOOMLA_URL` to a hostname that still serves
the old Joomla).

```bash
# on the VPS (uses the tools image of the last deploy)
bash /home/konrad/docker/bsv/dev/tools.sh /home/konrad/docker/bsv/dev migrate:joomla           # dry run: report only
bash /home/konrad/docker/bsv/dev/tools.sh /home/konrad/docker/bsv/dev migrate:joomla --apply   # import

# locally against the local Directus
pnpm --filter @bsv-sws/directus-tools migrate:joomla -- --apply
```

The report lists every crawled URL with its action (`create`, `update`, `redirect`, `manual`,
`skip`). `manual` lines need a decision: e.g. links that are already broken on the old site or
files missing there.

## Result of the rehearsal (2026-11-04, empty database)

37 URLs crawled → 4 articles, 1 new page (`/links`), 14 base pages filled + home intro,
10 events (one linked under two URLs), 118 files, 11 redirects. Manual: `/9-landesseniorenspiele-2010-`
(404 on the old site) and one PDF under `/wp-content/…` that no longer exists. Second run: no
changes.

## Review after the import (federation)

- Pages: layout of tables/images, outdated content, `/links` → add to navigation or delete.
- Events: calendar, categories, organizer; past events are kept as archive.
- News: categories (all _Allgemein_), teasers, featured images (none imported).
- Internal content from the old Joomla login area: create as protected pages
  (visibility _Verein_ …) with documents in "Seitendokumente".
- Old URLs that are still referenced elsewhere (e.g. in emails, other websites): add redirects in
  Studio → _Weiterleitungen_.
