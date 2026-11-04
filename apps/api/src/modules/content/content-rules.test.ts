import { describe, expect, it } from "vitest";
import {
  buildNavigation,
  buildPageIndex,
  normalizePath,
  type NavRow,
  type PageNode,
} from "./content-rules.js";

const page = (
  id: string,
  slug: string,
  parent: string | null,
  over: Partial<PageNode> = {},
): PageNode => ({
  id,
  slug,
  title: slug,
  parent,
  status: "published",
  visibility: "public",
  sort: 0,
  ...over,
});

describe("page index", () => {
  const pages = [
    page("v", "verband", null),
    page("vo", "vorstand", "v"),
    page("s", "satzung", "v", { status: "draft" }),
    page("h", "hidden", null, { status: "draft" }),
    page("hc", "child", "h"),
    page("i", "intern-info", null, { visibility: "club" }),
  ];
  const index = buildPageIndex(pages);

  it("resolves hierarchical paths", () => {
    expect(index.byPath.get("verband/vorstand")?.id).toBe("vo");
    expect(index.byPath.get("verband")?.id).toBe("v");
  });

  it("hides drafts and the whole subtree of unpublished parents", () => {
    expect(index.byPath.has("verband/satzung")).toBe(false);
    expect(index.byPath.has("hidden/child")).toBe(false);
  });

  it("lists published children and ancestors", () => {
    expect(index.children(pages[0]!).map((p) => p.slug)).toEqual(["vorstand"]);
    expect(index.ancestors(pages[1]!).map((p) => p.slug)).toEqual(["verband"]);
  });

  it("survives cycles", () => {
    const cyclic = buildPageIndex([page("a", "a", "b"), page("b", "b", "a")]);
    expect(cyclic.byPath.size).toBe(0);
  });

  it("normalises request paths", () => {
    expect(normalizePath("/Verband//Vorstand/")).toBe("verband/vorstand");
  });
});

describe("navigation", () => {
  const row = (id: number, label: string, over: Partial<NavRow> = {}): NavRow => ({
    id,
    menu: "main",
    label,
    parent: null,
    link_type: "route",
    page: null,
    article: null,
    route: "/x",
    url: null,
    visibility: "public",
    open_in_new_tab: false,
    active: true,
    sort: id,
    ...over,
  });
  const targets = {
    pages: new Map([
      ["vo", { path: "verband/vorstand", visibility: "public" as const }],
      ["i", { path: "intern-info", visibility: "club" as const }],
    ]),
    articles: new Map([["a1", "neue-webseite"]]),
  };
  const rows: NavRow[] = [
    row(1, "Verband", { link_type: "none" }),
    row(2, "Vorstand", { parent: 1, link_type: "page", page: "vo" }),
    row(3, "Kaputt", { parent: 1, link_type: "page", page: "missing" }),
    row(4, "Leer", { link_type: "none" }),
    row(5, "News-Artikel", { link_type: "article", article: "a1" }),
    row(6, "DSV", { link_type: "url", url: "https://dsv.de", open_in_new_tab: true }),
    row(7, "Inaktiv", { active: false }),
    row(8, "Nur Vereine", { visibility: "club" }),
    row(9, "Interne Seite", { link_type: "page", page: "i" }),
    row(10, "Böse", { link_type: "url", url: "javascript:alert(1)" }),
    row(11, "Fußzeile", { menu: "footer" }),
  ];

  it("builds the visible public tree and drops broken, empty, inactive and unsafe items", () => {
    const nav = buildNavigation(rows, "main", "visitor", targets);
    expect(nav.map((n) => n.label)).toEqual(["Verband", "News-Artikel", "DSV"]);
    expect(nav[0]).toMatchObject({
      href: null,
      children: [{ label: "Vorstand", href: "/verband/vorstand" }],
    });
    expect(nav[1]!.href).toBe("/news/neue-webseite");
    expect(nav[2]).toMatchObject({ href: "https://dsv.de", external: true, newTab: true });
  });

  it("respects visibility of items and target pages", () => {
    const nav = buildNavigation(rows, "main", "club_member", targets);
    expect(nav.map((n) => n.label)).toEqual(
      expect.arrayContaining(["Nur Vereine", "Interne Seite"]),
    );
  });

  it("separates menus", () => {
    expect(buildNavigation(rows, "footer", "visitor", targets).map((n) => n.label)).toEqual([
      "Fußzeile",
    ]);
  });
});
