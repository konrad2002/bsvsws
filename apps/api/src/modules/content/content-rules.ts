/**
 * Pure rules for pages and navigation (spec §8.3–8.4, §9.2, §19.6).
 */
import {
  canSeeVisibility,
  VISIBILITY_LEVELS,
  type UserLevel,
  type VisibilityLevel,
} from "@bsv-sws/shared";
import type { NavItem } from "@bsv-sws/validation";

export interface PageNode {
  id: string;
  slug: string;
  title: string;
  parent: string | null;
  status: "draft" | "published";
  visibility: VisibilityLevel;
  sort: number | null;
}

/** The stricter of two visibility levels. */
export function stricterVisibility(a: VisibilityLevel, b: VisibilityLevel): VisibilityLevel {
  return VISIBILITY_LEVELS.indexOf(a) >= VISIBILITY_LEVELS.indexOf(b) ? a : b;
}

/** Protected pages live in the internal area (owner decision), public pages at their path. */
export const INTERNAL_PAGES_PREFIX = "/intern/seiten";
export function pageHref(path: string, effectiveVisibility: VisibilityLevel): string {
  return effectiveVisibility === "public" ? `/${path}` : `${INTERNAL_PAGES_PREFIX}/${path}`;
}

/**
 * Index of pages by URL path ("verband/vorstand"). A page is reachable only if it
 * and all ancestors are published (unpublishing a parent hides the subtree).
 * A page is never more visible than its ancestors (effective visibility).
 * Duplicate paths: the first by sort wins (editors are warned in the field note).
 */
export function buildPageIndex(pages: PageNode[]) {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const sorted = [...pages].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const pathCache = new Map<string, string | null>();

  function pathOf(page: PageNode, seen = new Set<string>()): string | null {
    if (pathCache.has(page.id)) return pathCache.get(page.id)!;
    if (seen.has(page.id)) return null; // cycle
    seen.add(page.id);
    let path: string | null;
    if (page.status !== "published") path = null;
    else if (!page.parent) path = page.slug;
    else {
      const parent = byId.get(page.parent);
      const parentPath = parent ? pathOf(parent, seen) : null;
      path = parentPath ? `${parentPath}/${page.slug}` : null;
    }
    pathCache.set(page.id, path);
    return path;
  }

  const byPath = new Map<string, PageNode>();
  for (const page of sorted) {
    const path = pathOf(page);
    if (path && !byPath.has(path)) byPath.set(path, page);
  }

  const visibilityCache = new Map<string, VisibilityLevel>();
  function effectiveVisibility(page: PageNode, depth = 0): VisibilityLevel {
    const cached = visibilityCache.get(page.id);
    if (cached) return cached;
    const parent = page.parent ? byId.get(page.parent) : undefined;
    const result =
      parent && depth < 50
        ? stricterVisibility(page.visibility, effectiveVisibility(parent, depth + 1))
        : page.visibility;
    visibilityCache.set(page.id, result);
    return result;
  }

  return {
    byPath,
    pathOf: (page: PageNode) => pathOf(page),
    effectiveVisibility: (page: PageNode) => effectiveVisibility(page),
    /** Public URL or internal URL depending on the effective visibility. */
    hrefOf: (page: PageNode) => {
      const path = pathOf(page);
      return path ? pageHref(path, effectiveVisibility(page)) : null;
    },
    /** Breadcrumb trail (ancestors, root first) for a reachable page. */
    ancestors(page: PageNode): PageNode[] {
      const trail: PageNode[] = [];
      let current = page.parent ? byId.get(page.parent) : undefined;
      while (current) {
        trail.unshift(current);
        current = current.parent ? byId.get(current.parent) : undefined;
      }
      return trail;
    },
    children: (page: PageNode) => sorted.filter((p) => p.parent === page.id && pathOf(p)),
  };
}

/** Normalises a requested URL path to the index key ("/Verband/Vorstand/" → "verband/vorstand"). */
export function normalizePath(path: string): string {
  return path.split("/").filter(Boolean).join("/").toLowerCase();
}

export interface NavRow {
  id: number;
  menu: "main" | "footer" | "internal";
  label: string;
  parent: number | null;
  link_type: "page" | "article" | "route" | "url" | "none";
  page: string | null;
  article: string | null;
  route: string | null;
  url: string | null;
  visibility: VisibilityLevel;
  open_in_new_tab: boolean;
  active: boolean;
  sort: number | null;
}

export interface NavTargets {
  /** page id → link target (only reachable pages) and its effective visibility */
  pages: Map<string, { href: string; visibility: VisibilityLevel }>;
  /** article id → slug (only publicly published articles) */
  articles: Map<string, string>;
}

/**
 * Builds the visible navigation tree for a user level (spec §9.2: visibility must
 * respect permissions). Items whose target is not reachable/visible are hidden;
 * group items ("none" or broken links) are hidden when they have no visible children.
 */
export function buildNavigation(
  rows: NavRow[],
  menu: NavRow["menu"],
  level: UserLevel,
  targets: NavTargets,
): NavItem[] {
  const active = rows.filter(
    (r) => r.menu === menu && r.active && canSeeVisibility(level, r.visibility),
  );
  const sorted = [...active].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id);

  const hrefOf = (r: NavRow): { href: string | null; external: boolean } | undefined => {
    switch (r.link_type) {
      case "page": {
        const target = r.page ? targets.pages.get(r.page) : undefined;
        if (!target || !canSeeVisibility(level, target.visibility)) return undefined;
        return { href: target.href, external: false };
      }
      case "article": {
        const slug = r.article ? targets.articles.get(r.article) : undefined;
        return slug ? { href: `/news/${slug}`, external: false } : undefined;
      }
      case "route":
        return r.route && r.route.startsWith("/") && !r.route.startsWith("//")
          ? { href: r.route, external: false }
          : undefined;
      case "url":
        return r.url && /^https?:\/\//i.test(r.url) ? { href: r.url, external: true } : undefined;
      case "none":
        return { href: null, external: false };
    }
  };

  const build = (parent: number | null, depth: number): NavItem[] =>
    depth > 3
      ? []
      : sorted
          .filter((r) => r.parent === parent)
          .flatMap((r) => {
            const link = hrefOf(r);
            const children = build(r.id, depth + 1);
            if (!link && children.length === 0) return [];
            if (link?.href === null && children.length === 0) return [];
            return [
              {
                id: r.id,
                label: r.label,
                href: link?.href ?? null,
                external: link?.external ?? false,
                newTab: r.open_in_new_tab,
                children,
              },
            ];
          });

  return build(null, 0);
}

// --- protected files (spec §8.5) ------------------------------------------------

export type FileAccess = "allow" | "unauthenticated" | "forbidden" | "not_found";

/**
 * A CMS file is visible exactly like the content that references it: public if it
 * is in the public media folder or referenced by any visible public content,
 * otherwise only for users who may see at least one referencing page.
 * `references` = effective visibilities of published, reachable pages/articles
 * whose content contains the file (articles are always "public").
 */
export function fileAccess(input: {
  inPublicFolder: boolean;
  references: VisibilityLevel[];
  level: UserLevel;
  authenticated: boolean;
}): FileAccess {
  if (input.inPublicFolder) return "allow";
  if (input.references.length === 0) return "not_found";
  if (input.references.some((v) => canSeeVisibility(input.level, v))) return "allow";
  return input.authenticated ? "forbidden" : "unauthenticated";
}

export interface HomepageRow {
  hero_enabled: boolean | null;
  hero_kicker: string | null;
  hero_title: string | null;
  hero_image: string | null;
  hero_button_label: string | null;
  hero_button_url: string | null;
}

/**
 * Home banner (Studio singleton `homepage`). The button links to an explicit target if
 * label + safe URL are set (internal path or http(s)), otherwise to the next event.
 */
export function buildHero(
  row: HomepageRow | null,
  nextEvent: { title: string; slug: string } | null,
): {
  kicker: string | null;
  title: string;
  imageId: string | null;
  button: { label: string; href: string; external: boolean } | null;
} | null {
  if (row && row.hero_enabled === false) return null;
  const url = row?.hero_button_url?.trim() ?? "";
  const label = row?.hero_button_label?.trim() ?? "";
  const internal = /^\/(?!\/)/.test(url);
  const external = /^https?:\/\//i.test(url);
  const button =
    label && (internal || external)
      ? { label, href: url, external }
      : nextEvent
        ? { label: nextEvent.title, href: `/veranstaltungen/${nextEvent.slug}`, external: false }
        : null;
  return {
    kicker: row?.hero_kicker?.trim() || null,
    title: row?.hero_title?.trim() || "Bezirksschwimmverband Südwestsachsen e.V.",
    imageId: row?.hero_image ?? null,
    button,
  };
}
