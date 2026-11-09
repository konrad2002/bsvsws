# Launch

Steps and checks for going live (spec §17 Phase 8). Technical details:
[09-infrastructure.md](09-infrastructure.md#deployment-phase-8), content import:
[migration.md](migration.md).

## 1. Test environment

- [ ] `bsv.konrad2002.de` + `bsv-cms.konrad2002.de` point to the dev host; nginx container has
      `infrastructure/deployment/nginx/bsv-dev.conf.example` and the `konrad2002.de` certificate;
      `.env` sets `PROXY_NETWORK` (nginx network) and `PROXY_ALIAS=bsv-dev`.
- [ ] `/home/konrad/docker/bsv/dev/.env` filled (own secrets, IONOS SMTP, licence key), GitHub Environment
      `test` configured (`VPS_*` secrets, `DEPLOY_DIR=/home/konrad/docker/bsv/dev`,
      `WEB_PUBLIC_URL=https://bsv.konrad2002.de`).
- [ ] Push to `develop` → workflow green incl. deploy + smoke test.
- [ ] Studio login with the bootstrap admin; create Verband accounts; licence active.
- [ ] Migration: dry run, `--apply`, review ([migration.md](migration.md#review-after-the-import-federation)).
- [ ] Email: invite a test club representative to your own address → mail arrives (not spam),
      registration with code works.

## 2. Final manual review (on test)

Public:

- [ ] Home, news list/detail/pagination/categories, all pages of the main and footer menus.
- [ ] Event calendar: list, month, year, filters, detail pages, WebCal subscription in a
      calendar app (`webcal://…/kalender/alle.ics`).
- [ ] Club pages; Impressum and Datenschutz content correct and complete.
- [ ] Mobile layout (phone), keyboard navigation of the menus.
- [ ] Legacy URLs: a sample of old links (news, pages, `/kalender/eventdetail/…`) answers with
      200 or a 308 redirect, unknown paths with 404 (`curl -I`).

Internal (with real accounts of each level):

- [ ] Club creation, representative invitation, registration, member invitation, promote/demote/remove.
- [ ] Event: create, submit, reject, resubmit, approve/publish, removal request and decision;
      review emails reach the configured recipients.
- [ ] Protected pages and documents per level (403 for insufficient level, login redirect).
- [ ] Federation: Einstellungen, Benutzerkonten, Protokoll, Studio links.
- [ ] Directus Studio: federation users can edit content, cannot change workflow data/settings.

## 3. Production

- [ ] **Backups (spec §14.5, currently deferred):** daily PostgreSQL + uploads backup, retention,
      offsite copy and a **successful test restore** – required before launch.
- [ ] Production host and directory (e.g. `/opt/bsv-sws/production`), `.env` with **new** secrets
      (never copy test secrets), GitHub Environment `production` (required reviewers, `master`
      only), then set the repository variable `DEPLOY_PRODUCTION=true`.
- [ ] Merge `develop` → `master` via reviewed PR → deploy to production green.
- [ ] Bootstrap admin login, Verband accounts, licence (separate OIG activation).
- [ ] Migration against production **before** the DNS switch (`JOOMLA_URL` must still reach Joomla).
- [ ] Content review on production (`cms.` subdomain and the production host before DNS, e.g. via
      `/etc/hosts`).

## 4. Go-live (DNS switch)

1. Lower the DNS TTL of `bsv-sws.de`/`www` a day before.
2. Freeze content changes on the old Joomla; re-run the migration (idempotent – picks up new
   news/events only).
3. Point `bsv-sws.de`, `www.bsv-sws.de`, `cms.bsv-sws.de` to the VPS; issue certificates.
4. Check: home, a news article, a legacy event URL redirect, login, an invitation email.
5. Keep the old Joomla installation (offline, not publicly reachable) and its database/file
   backup for at least a few months for reference.

## Rollback

- App: re-run an older successful deploy job (or `deploy.sh <env-dir> <older-sha>`).
- Go-live: point DNS back to the old host (old Joomla still installed).
