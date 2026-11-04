/**
 * Initial base data inserted by `directus:apply` in EVERY environment (owner
 * decision), only if missing – administrator edits are never overwritten.
 */
import { DIRECTUS_FOLDER_IDS } from "@bsv-sws/directus";

export const BASE_EVENT_CATEGORIES = [
  { slug: "wettkampf", name: "Wettkampf", sort: 1 },
  { slug: "kampfrichter", name: "Kampfrichter", sort: 2 },
  { slug: "verband", name: "Verband", sort: 3 },
];

export const BASE_ARTICLE_CATEGORIES = [{ slug: "allgemein", name: "Allgemein", sort: 1 }];

/** Media folders with fixed ids (access rules depend on them). */
export const MEDIA_FOLDERS = [
  { id: DIRECTUS_FOLDER_IDS.publicMedia, name: "Öffentliche Medien" },
  { id: DIRECTUS_FOLDER_IDS.pageDocuments, name: "Seitendokumente" },
];

export interface BasePage {
  slug: string;
  title: string;
  children?: BasePage[];
}

const PLACEHOLDER = "<p>Dieser Inhalt wird gerade übertragen.</p>";
export const placeholderContent = (title: string) => `<p>${title}</p>${PLACEHOLDER}`;

/** Page structure of the current website (spec §9.1) + legal pages. Created only if `pages` is empty. */
export const BASE_PAGES: BasePage[] = [
  { slug: "startseite", title: "Willkommen beim Bezirksschwimmverband Südwestsachsen" },
  {
    slug: "sportarten",
    title: "Sportarten",
    children: [
      { slug: "schwimmen", title: "Schwimmen" },
      { slug: "wasserball", title: "Wasserball" },
      { slug: "synchronschwimmen", title: "Synchronschwimmen" },
      { slug: "masters", title: "Masters" },
    ],
  },
  {
    slug: "verband",
    title: "Verband",
    children: [
      { slug: "vorstand", title: "Vorstand & Fachwarte" },
      { slug: "schwimmjugend", title: "Schwimmjugend" },
      { slug: "kampfrichter", title: "Kampfrichterwesen" },
      { slug: "schiedsrichter", title: "Schiedsrichter" },
      { slug: "wettkampfbestimmungen", title: "Wettkampfbestimmungen" },
      { slug: "satzung", title: "Satzung" },
      { slug: "historie", title: "Historie" },
    ],
  },
  { slug: "team-westsachsen", title: "Team Westsachsen" },
  { slug: "impressum", title: "Impressum" },
  { slug: "datenschutz", title: "Datenschutz" },
];

export type BaseNavItem =
  | { label: string; route: string; children?: BaseNavItem[] }
  | { label: string; pagePath: string; children?: BaseNavItem[] };

/** Header navigation of the current website (spec §9.1). Created only if no navigation exists. */
export const BASE_MAIN_NAVIGATION: BaseNavItem[] = [
  { label: "Startseite", route: "/" },
  { label: "Veranstaltungen", route: "/veranstaltungen" },
  { label: "News", route: "/news" },
  {
    label: "Sportarten",
    pagePath: "sportarten",
    children: [
      { label: "Schwimmen", pagePath: "sportarten/schwimmen" },
      { label: "Wasserball", pagePath: "sportarten/wasserball" },
      { label: "Synchronschwimmen", pagePath: "sportarten/synchronschwimmen" },
      { label: "Masters", pagePath: "sportarten/masters" },
    ],
  },
  {
    label: "Verband",
    pagePath: "verband",
    children: [
      { label: "Vorstand & Fachwarte", pagePath: "verband/vorstand" },
      { label: "Schwimmjugend", pagePath: "verband/schwimmjugend" },
      { label: "Kampfrichterwesen", pagePath: "verband/kampfrichter" },
      { label: "Schiedsrichter", pagePath: "verband/schiedsrichter" },
      { label: "Wettkampfbestimmungen", pagePath: "verband/wettkampfbestimmungen" },
      { label: "Satzung", pagePath: "verband/satzung" },
      { label: "Historie", pagePath: "verband/historie" },
    ],
  },
  { label: "Team Westsachsen", pagePath: "team-westsachsen" },
  { label: "Vereine", route: "/vereine" },
  { label: "Intern", route: "/intern" },
];

export const BASE_FOOTER_NAVIGATION: BaseNavItem[] = [
  { label: "Impressum", pagePath: "impressum" },
  { label: "Datenschutz", pagePath: "datenschutz" },
];
