import { aggregate, readFile, readItem, readItems } from "@directus/sdk";
import { DIRECTUS_FOLDER_IDS } from "@bsv-sws/directus";
import type { Sport, UserLevel, VisibilityLevel } from "@bsv-sws/shared";
import type {
  ArticleDetail,
  ArticlePage,
  ArticleSummary,
  Navigation,
  PublicClub,
  PublicClubDetail,
  PublicPage,
} from "@bsv-sws/validation";
import type { ServiceClient } from "../../lib/directus.js";
import { isNotFoundOrForbidden } from "../../lib/directus-errors.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { canSeeVisibility } from "@bsv-sws/shared";
import {
  buildNavigation,
  buildPageIndex,
  normalizePath,
  type NavRow,
  type PageNode,
  fileAccess,
  INTERNAL_PAGES_PREFIX,
  type FileAccess,
} from "./content-rules.js";
import { sanitizeContent } from "./sanitize.js";

/**
 * Public CMS read model (Phase 5). Reads with the service account and applies
 * status, publication date and visibility rules here (Directus public
 * permissions cannot filter rows without a licence). HTML is sanitized.
 * `level` is the caller's user level; public routes pass "visitor".
 */

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  teaser: string | null;
  content?: string | null;
  published_at: string;
  featured_image: string | null;
  author_name: string | null;
  author: { first_name: string | null; last_name: string | null } | null;
  user_created: { first_name: string | null; last_name: string | null } | null;
  category: { name: string; slug: string } | null;
  date_updated?: string | null;
}

const ARTICLE_FIELDS = [
  "id",
  "slug",
  "title",
  "teaser",
  "published_at",
  "featured_image",
  "author_name",
  "author.first_name",
  "author.last_name",
  "user_created.first_name",
  "user_created.last_name",
  "category.name",
  "category.slug",
];

const CLUB_FIELDS = ["id", "name", "short_name", "slug", "city", "sports", "logo"];

const fullName = (u: { first_name: string | null; last_name: string | null } | null) =>
  u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || null : null;

export function createPublicContentService(deps: {
  client: ServiceClient;
  directusUrl: string;
  serviceToken: string;
  now?: () => Date;
}) {
  const { client } = deps;
  const nowIso = () => (deps.now ? deps.now() : new Date()).toISOString();

  /** Published and due articles only. */
  const articleFilter = () => ({ status: { _eq: "published" }, published_at: { _lte: nowIso() } });

  async function pageIndex() {
    const pages = (await client.request(
      readItems(
        "pages" as never,
        {
          fields: ["id", "slug", "title", "parent", "status", "visibility", "sort"],
          limit: -1,
        } as never,
      ),
    )) as PageNode[];
    return buildPageIndex(pages);
  }

  function toArticle(row: ArticleRow): ArticleSummary {
    return {
      slug: row.slug,
      title: row.title,
      teaser: row.teaser,
      publishedAt: row.published_at,
      category: row.category ?? { name: "Allgemein", slug: "allgemein" },
      featuredImage: row.featured_image,
      author: row.author_name || fullName(row.author) || fullName(row.user_created),
    };
  }

  /** Exact match on "path?query" first, then path only. */
  async function findRedirect(
    path: string,
    query: string,
  ): Promise<{ to: string; permanent: boolean } | null> {
    const candidates = query ? [`${path}?${query}`, path] : [path];
    const rows = (await client.request(
      readItems(
        "redirects" as never,
        {
          filter: { active: { _eq: true }, from_path: { _in: candidates } },
          fields: ["from_path", "to_path", "permanent"],
          limit: 2,
        } as never,
      ),
    )) as { from_path: string; to_path: string; permanent: boolean }[];
    const hit = candidates.map((c) => rows.find((r) => r.from_path === c)).find(Boolean);
    return hit ? { to: hit.to_path, permanent: hit.permanent } : null;
  }

  return {
    /** Visible menus for a user level. Public site: "visitor"; internal area: the user's level. */
    async navigation(level: UserLevel): Promise<Navigation> {
      const [rows, index, articles] = await Promise.all([
        client.request(
          readItems(
            "navigation_items" as never,
            {
              fields: [
                "id",
                "menu",
                "label",
                "parent",
                "link_type",
                "page",
                "article",
                "route",
                "url",
                "visibility",
                "open_in_new_tab",
                "active",
                "sort",
              ],
              limit: -1,
            } as never,
          ),
        ) as Promise<NavRow[]>,
        pageIndex(),
        client.request(
          readItems(
            "articles" as never,
            { filter: articleFilter(), fields: ["id", "slug"], limit: -1 } as never,
          ),
        ) as Promise<{ id: string; slug: string }[]>,
      ]);
      const pages = new Map<string, { href: string; visibility: VisibilityLevel }>();
      for (const page of index.byPath.values())
        pages.set(page.id, {
          href: index.hrefOf(page)!,
          visibility: index.effectiveVisibility(page),
        });
      const targets = { pages, articles: new Map(articles.map((a) => [a.id, a.slug])) };
      return {
        main: buildNavigation(rows, "main", level, targets),
        footer: buildNavigation(rows, "footer", level, targets),
        internal: buildNavigation(rows, "internal", level, targets),
      };
    },

    /**
     * Page by URL path (effective visibility = strictest along the path).
     * Missing/unpublished → 404. Not visible for `level` → 404, or 403 with
     * `forbiddenIfHidden` (internal area, owner decision).
     */
    async page(
      path: string,
      level: UserLevel,
      opts: { forbiddenIfHidden?: boolean } = {},
    ): Promise<PublicPage> {
      const index = await pageIndex();
      const key = normalizePath(path);
      const node = index.byPath.get(key);
      if (!node) throw notFound("Seite nicht gefunden.");
      const visibility = index.effectiveVisibility(node);
      if (!canSeeVisibility(level, visibility)) {
        if (opts.forbiddenIfHidden) throw forbidden();
        throw notFound("Seite nicht gefunden.");
      }
      const full = (await client.request(
        readItem(
          "pages" as never,
          node.id as never,
          { fields: ["content", "date_updated", "date_created"] } as never,
        ),
      )) as { content: string | null; date_updated: string | null; date_created: string | null };
      return {
        id: node.id,
        title: node.title,
        path: `/${key}`,
        href: index.hrefOf(node)!,
        visibility,
        contentHtml: sanitizeContent(full.content),
        breadcrumbs: index.ancestors(node).map((p) => ({ title: p.title, href: index.hrefOf(p)! })),
        children: index
          .children(node)
          .filter((c) => canSeeVisibility(level, index.effectiveVisibility(c)))
          .map((c) => ({ title: c.title, href: index.hrefOf(c)! })),
        updatedAt: full.date_updated ?? full.date_created,
      };
    },

    /**
     * Status for internal pages (/intern/seiten/<path>) used by the Next.js proxy:
     * public pages live at their public URL, hidden ones are 403 (owner decision).
     */
    async resolveInternalPage(path: string, level: UserLevel) {
      const index = await pageIndex();
      const node = index.byPath.get(normalizePath(path));
      if (!node) return { action: "not_found" as const };
      const visibility = index.effectiveVisibility(node);
      if (visibility === "public")
        return { action: "redirect" as const, to: `/${normalizePath(path)}`, permanent: true };
      return canSeeVisibility(level, visibility)
        ? { action: "ok" as const }
        : { action: "forbidden" as const };
    },

    async articles(q: { category?: string; page: number; pageSize: number }): Promise<ArticlePage> {
      const filter: Record<string, unknown> = articleFilter();
      if (q.category) filter.category = { slug: { _eq: q.category } };
      const [rows, counted] = await Promise.all([
        client.request(
          readItems(
            "articles" as never,
            {
              filter,
              fields: ARTICLE_FIELDS,
              sort: ["-published_at"],
              limit: q.pageSize,
              offset: (q.page - 1) * q.pageSize,
            } as never,
          ),
        ) as Promise<ArticleRow[]>,
        client.request(
          aggregate("articles" as never, { aggregate: { count: "*" }, query: { filter } } as never),
        ) as Promise<{ count: string | number }[]>,
      ]);
      const total = Number(counted[0]?.count ?? 0);
      return {
        items: rows.map(toArticle),
        page: q.page,
        pageCount: Math.max(1, Math.ceil(total / q.pageSize)),
        total,
      };
    },

    async article(slug: string): Promise<ArticleDetail> {
      const [row] = (await client.request(
        readItems(
          "articles" as never,
          {
            filter: { ...articleFilter(), slug: { _eq: slug } },
            fields: [...ARTICLE_FIELDS, "content", "date_updated"],
            limit: 1,
          } as never,
        ),
      )) as ArticleRow[];
      if (!row) throw notFound("Artikel nicht gefunden.");
      return {
        ...toArticle(row),
        contentHtml: sanitizeContent(row.content),
        updatedAt: row.date_updated ?? null,
      };
    },

    async articleCategories() {
      return (await client.request(
        readItems(
          "article_categories" as never,
          {
            filter: { active: { _eq: true } },
            fields: ["name", "slug"],
            sort: ["sort", "name"],
            limit: -1,
          } as never,
        ),
      )) as { name: string; slug: string }[];
    },

    /** Club pages are generated from club records (spec §6.2, §8.6). Active clubs only. */
    async clubs(): Promise<PublicClub[]> {
      const rows = (await client.request(
        readItems("clubs", {
          filter: { active: { _eq: true } },
          fields: CLUB_FIELDS as never,
          sort: ["name"],
          limit: -1,
        }),
      )) as unknown as {
        id: string;
        name: string;
        short_name: string | null;
        slug: string;
        city: string | null;
        sports: Sport[] | null;
        logo: string | null;
      }[];
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        shortName: r.short_name,
        slug: r.slug,
        city: r.city,
        sports: r.sports ?? [],
        hasLogo: !!r.logo,
      }));
    },

    async club(slug: string): Promise<PublicClubDetail> {
      const [r] = (await client.request(
        readItems("clubs", {
          filter: { active: { _eq: true }, slug: { _eq: slug } },
          fields: [
            ...CLUB_FIELDS,
            "description",
            "website",
            "email",
            "phone",
            "street",
            "postal_code",
            "venue",
          ] as never,
          limit: 1,
        }),
      )) as unknown as (Record<string, string | null> & { sports: Sport[] | null })[];
      if (!r) throw notFound("Verein nicht gefunden.");
      return {
        id: r.id!,
        name: r.name!,
        shortName: r.short_name ?? null,
        slug: r.slug!,
        city: r.city ?? null,
        sports: r.sports ?? [],
        hasLogo: !!r.logo,
        description: r.description ?? null,
        website: r.website ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        street: r.street ?? null,
        postalCode: r.postal_code ?? null,
        venue: r.venue ?? null,
      };
    },

    resolveRedirect: findRedirect,

    /**
     * Fast existence check used by the Next.js proxy BEFORE rendering, so missing
     * content gets a real 404 and legacy URLs a real 3xx (streamed responses are
     * always 200). Covers the dynamic public routes and the CMS catch-all.
     */
    async resolve(
      path: string,
      query: string,
    ): Promise<
      | { action: "ok" }
      | { action: "redirect"; to: string; permanent: boolean }
      | { action: "not_found" }
    > {
      const segments = path.split("/").filter(Boolean);
      const exists = async (collection: string, filter: Record<string, unknown>) =>
        (
          (await client.request(
            readItems(collection as never, { filter, fields: ["id"], limit: 1 } as never),
          )) as unknown[]
        ).length > 0;
      const [first, second, third] = segments;
      let found: boolean | null = null; // null = not a dynamic route → CMS page
      if (first === "news" && second === "kategorie" && third && segments.length === 3) {
        found = await exists("article_categories", { slug: { _eq: third }, active: { _eq: true } });
      } else if (first === "news" && second && segments.length === 2) {
        found = await exists("articles", { ...articleFilter(), slug: { _eq: second } });
      } else if (first === "vereine" && second && segments.length === 2) {
        found = await exists("clubs", { slug: { _eq: second }, active: { _eq: true } });
      } else if (first === "veranstaltungen" && second && segments.length === 2) {
        found = await exists("events", {
          slug: { _eq: second },
          status: { _eq: "published" },
          deleted_at: { _null: true },
        });
      }
      if (found === true) return { action: "ok" };
      if (found === null) {
        const index = await pageIndex();
        const node = index.byPath.get(normalizePath(path));
        if (node) {
          if (index.effectiveVisibility(node) === "public") return { action: "ok" };
          // Protected pages live in the internal area (old links keep working).
          return {
            action: "redirect",
            to: `${INTERNAL_PAGES_PREFIX}/${normalizePath(path)}`,
            permanent: false,
          };
        }
      }
      const redirect = await findRedirect(path, query);
      return redirect ? { action: "redirect", ...redirect } : { action: "not_found" };
    },

    /**
     * CMS files (/medien/<id>). Spec §8.5: a file is visible exactly like the
     * content that references it – public folder or public content → everyone;
     * otherwise only users who may see a referencing published page. Copying the
     * URL does not help: unreferenced non-public files are never served.
     */
    async file(
      fileId: string,
      level: UserLevel,
      authenticated: boolean,
      width?: number,
    ): Promise<
      | { access: Exclude<FileAccess, "allow"> }
      | {
          access: "allow";
          isPublic: boolean;
          body: Buffer;
          contentType: string;
          contentDisposition: string | null;
        }
    > {
      let file: { folder: string | null; type: string | null };
      try {
        // readItem() refuses system collections – use the dedicated files command.
        file = (await client.request(
          readFile(fileId, { fields: ["folder", "type"] }),
        )) as typeof file;
      } catch (error) {
        if (isNotFoundOrForbidden(error)) return { access: "not_found" };
        throw error;
      }
      const inPublicFolder = file.folder === DIRECTUS_FOLDER_IDS.publicMedia;
      const references: VisibilityLevel[] = [];
      if (!inPublicFolder) {
        const [pages, articles, index] = await Promise.all([
          client.request(
            readItems(
              "pages" as never,
              {
                filter: { status: { _eq: "published" }, content: { _contains: fileId } },
                fields: ["id"],
                limit: -1,
              } as never,
            ),
          ) as Promise<{ id: string }[]>,
          client.request(
            readItems(
              "articles" as never,
              {
                filter: {
                  ...articleFilter(),
                  _or: [{ content: { _contains: fileId } }, { featured_image: { _eq: fileId } }],
                },
                fields: ["id"],
                limit: 1,
              } as never,
            ),
          ) as Promise<unknown[]>,
          pageIndex(),
        ]);
        if (articles.length) references.push("public");
        const reachable = new Map([...index.byPath.values()].map((p) => [p.id, p]));
        for (const { id } of pages) {
          const node = reachable.get(id);
          if (node) references.push(index.effectiveVisibility(node));
        }
      }
      const access = fileAccess({ inPublicFolder, references, level, authenticated });
      if (access !== "allow") return { access };

      const url = new URL(`/assets/${fileId}`, deps.directusUrl);
      if (width && file.type?.startsWith("image/") && file.type !== "image/svg+xml")
        url.searchParams.set("width", String(width));
      const res = await fetch(url, { headers: { authorization: `Bearer ${deps.serviceToken}` } });
      if (!res.ok) return { access: "not_found" };
      return {
        access: "allow",
        isPublic: inPublicFolder || references.includes("public"),
        body: Buffer.from(await res.arrayBuffer()),
        contentType: res.headers.get("content-type") ?? "application/octet-stream",
        contentDisposition: res.headers.get("content-disposition"),
      };
    },
  };
}

export type PublicContentService = ReturnType<typeof createPublicContentService>;
