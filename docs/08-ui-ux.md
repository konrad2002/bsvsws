# UI / UX Conventions

The visual identity (colours, typography, imagery) is decided by the project owner (spec §9.5).
Everything here describes **functional conventions**; current styling is a neutral placeholder.

## Components

- Shared, reusable components live in `packages/ui` (shadcn/ui style): `Button`
  (`buttonVariants`), `Input`, `Textarea`, `Select`, `Label`, `Field` (label + control + hint/error),
  `Alert` (info/error/success), `Badge`. Design tokens go into `packages/ui/src/styles/theme.css`.
- Layout-specific components stay in the app: `components/public/*` (site navigation, calendar
  views, news cards, rich content), `components/internal/*` (forms, tables, workflow panels).
- CMS HTML is rendered only through `RichContent` (input already sanitized by the API) and styled
  by `src/styles/rich-content.scss`.

## Patterns

- Language: German UI, informal "du" in the internal area and system emails.
- Dates `TT.MM.JJJJ` / `4. November 2026` (news), times `HH:MM Uhr`, all in Europe/Berlin.
- Forms show field errors under the field and a general error above the submit button; success
  messages as `Alert variant="success"`.
- Destructive actions ask for confirmation; workflow actions show only what the API allows
  (`allowedActions`).
- Navigation: desktop dropdowns open on hover **and** keyboard focus; mobile uses a native
  `<details>` menu – both work without JavaScript. Filters are GET forms.
- Responsive: tables scroll horizontally on small screens; the month calendar becomes a day list.
- Accessibility: every control is labelled, sections use `aria-labelledby`, active views/pages
  use `aria-current`, decorative images have empty `alt`, external links open with
  `rel="noopener noreferrer"`.
- Missing content returns a real HTTP 404 (detail pages check existence before streaming).
