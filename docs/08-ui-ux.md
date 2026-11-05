# UI / UX Conventions

The visual identity follows the old bsv-sws.de (spec §9.5, owner decisions 2026-11-05): white
header with logo, grey content area with a white "Neuigkeiten" sidebar, blue headings, tables
with blue head and zebra rows, navy footer, a navy home banner with a photo, and a dark header
in the internal area. Font: the system stack the old site actually rendered (Helvetica Neue,
Helvetica, Arial).

## Changing the look – one place

All colours, the font and the radius are **tokens** in
[`packages/ui/src/styles/theme.css`](../packages/ui/src/styles/theme.css). Components never use
raw colours (`neutral-600`, `#027db5`, …) – only semantic Tailwind classes generated from the
tokens. Changing a token changes every page.

| Layer           | Where (theme.css)                       | Examples                                                                                                                                                                                          |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand palette   | `:root` part 1                          | `--bsv-1` `#027db5`, `--bsv-2` `#04aadb`, `--bsv-dark` `#0d2046`, `--bsv-dark-2` `#0d2c68`                                                                                                        |
| Semantic tokens | `:root` part 2                          | `--primary`, `--accent`, `--muted(-foreground)`, `--border`, `--page`, `--card`, `--link`, `--heading-1/2`, `--header-*`, `--footer-*`, `--hero-*`, `--table-*`, `--radius`, `--font-family-base` |
| Scopes          | `.theme-public`, `.theme-dark-header`   | override tokens for an area (centred page titles; dark internal header)                                                                                                                           |
| Base styles     | `@layer base`                           | `h1`/`h2`/`h3`, plain links, focus outline, default border colour                                                                                                                                 |
| Shared classes  | `@utility link`, `.card`, `.data-table` | brand text link (incl. bold `aria-current`), white box on grey, tables                                                                                                                            |

Tailwind classes available from the tokens: `bg-primary`, `hover:bg-primary-hover`,
`text-primary-foreground`, `bg-accent`, `bg-muted`, `text-muted-foreground`, `border-border`,
`border-input`, `bg-page`, `bg-card`, `text-link`, `text-heading-1/2`, `bg-header`,
`text-header-foreground`, `bg-footer`, `bg-hero`, `text-destructive`, `text-success`, ….

Rules:

- **Headings** get size, weight and colour from the base styles – write `<h1>`/`<h2>` without
  classes. Page titles are centred on the public site (`--title-align` in `.theme-public`).
- **Text links** in components: `className="link"`. Plain `<a>` without classes (CMS content)
  get the same style automatically. Links inside headings keep the heading colour.
- **Tables**: `className="data-table"`; CMS tables get it automatically.
- **Boxes** on the grey area: `className="card"`.
- **shadcn components** (`packages/ui/src/components`) only take colours from tokens; their
  shape and size stay shadcn defaults.
- New colours: add a brand value and/or a semantic token in theme.css and map it in
  `@theme inline` – never hard-code it in a component.

## Layouts

| Area                                | File                                | Structure                                                                  |
| ----------------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| Public                              | `app/(public)/layout.tsx`           | `SiteHeader` · grey `main` · `SiteFooter`, scope `.theme-public`           |
| CMS pages + news                    | `app/(public)/(sidebar)/layout.tsx` | content column + `NewsSidebar` (latest 3 news, hidden below `md`)          |
| Calendar, clubs, login, invitations | `app/(public)/(wide)/layout.tsx`    | full-width content                                                         |
| Home                                | `app/(public)/page.tsx`             | `HomeHero` (Studio: Inhalte → Startseite) + intro, news cards, next events |
| Internal                            | `app/(internal)/intern/layout.tsx`  | `SiteHeader` with `.theme-dark-header` + internal sub-nav + grey `main`    |

Content spacing: the `page-padding` utility (`apps/web/src/app/globals.css`). Shared chrome lives
in `components/layout/` (header, navigation, footer, sidebar).

## Components

- Shared, reusable components live in `packages/ui` (shadcn/ui style): `Button`
  (`buttonVariants`), `Input`, `Textarea`, `Select`, `Label`, `Field` (label + control + hint/error),
  `Alert` (info/error/success), `Badge`.
- Layout-specific components stay in the app: `components/layout/*`, `components/public/*`
  (calendar views, news cards, rich content, home banner), `components/internal/*`.
- CMS HTML is rendered only through `RichContent` (input already sanitized by the API); its
  spacing is in `src/styles/rich-content.scss`, colours/headings/tables come from the theme.
- Assets: logo `apps/web/public/logo-bsv.svg`, favicons in `apps/web/src/app` (from bsv-sws.de).

## Patterns

- Language: German UI, informal "du" in the internal area and system emails.
- Dates `TT.MM.JJJJ` / `4. November 2026` (news), times `HH:MM Uhr`, all in Europe/Berlin.
- Forms show field errors under the field and a general error above the submit button; success
  messages as `Alert variant="success"`.
- Destructive actions ask for confirmation; workflow actions show only what the API allows
  (`allowedActions`).
- Navigation: desktop dropdowns open on hover **and** keyboard focus (▾ marker is
  `aria-hidden`); below `lg` a burger button opens a native `<details>` menu – both work without
  JavaScript. Filters are GET forms.
- Responsive: tables scroll horizontally on small screens; the month calendar becomes a day list.
- Accessibility: every control is labelled, sections use `aria-labelledby`, active views/pages
  use `aria-current`, decorative images have empty `alt`, external links open with
  `rel="noopener noreferrer"`.
- Missing content returns a real HTTP 404 (detail pages check existence before streaming).
