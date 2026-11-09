/**
 * Migration of the public Joomla site (spec §17 Phase 8, owner decision: crawl the
 * public site). Crawls JOOMLA_URL, then imports into the Directus at DIRECTUS_URL:
 *
 *   - news articles  → `articles` (published, original date/author, default category)
 *   - pages          → `pages` (fills the placeholder base pages; creates missing ones)
 *   - JEvents events → `events` (published federation events + local files as event files)
 *   - images/files under /images/ → Directus files ("Öffentliche Medien" for news,
 *                                    "Seitendokumente" for pages)
 *   - legacy URLs that changed (events, list pagination) → `redirects`
 *   - photo of the home banner → `homepage.hero_image` (only if none is set)
 *
 * Default is a dry run that only prints the plan/report. `--apply` writes.
 * Idempotent: existing articles (slug), events (title + start date), pages with real
 * content, files (description `joomla:<path>`) and redirects are skipped.
 *
 *   pnpm --filter @bsv-sws/directus-tools migrate:joomla [-- --apply]
 *   deployed: tools.sh /opt/bsv-sws/test migrate:joomla --apply   (docs/migration.md)
 *
 * Internal Joomla content (behind login) is NOT reachable and must be moved by hand.
 */
import {
  createItem,
  createItems,
  readFiles,
  readItems,
  readSingleton,
  updateSingleton,
  updateItem,
  uploadFiles,
} from "@directus/sdk";
import { DIRECTUS_FOLDER_IDS } from "@bsv-sws/directus";
import { slugify } from "@bsv-sws/shared";
import { PLACEHOLDER } from "./base-data.js";
import { adminClient } from "./env.js";
import {
  assetReferences,
  classify,
  extractLinks,
  isCrawlable,
  parseArticle,
  parseEvent,
  parseHomeBanner,
  parsePage,
  rewriteHtml,
  type PageKind,
  type ParsedArticle,
  type ParsedEvent,
  type ParsedPage,
} from "./joomla/parse.js";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const BASE = (process.env.JOOMLA_URL ?? "https://bsv-sws.de").replace(/\/$/, "");
const MAX_PAGES = 500;
const DELAY_MS = 250;
const UA = "bsv-sws-migration/1.0 (website relaunch import)";
const ORGANIZER = "Bezirksschwimmverband Südwestsachsen";

const client = adminClient();
/** Files that could not be copied (reported as manual work). */
const failedFiles: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 1. Crawl
// ---------------------------------------------------------------------------
interface Crawled {
  path: string;
  status: number;
  kind: PageKind | "error";
  html: string;
}

async function crawl(): Promise<Crawled[]> {
  const queue = ["/", "/news", "/veranstaltungen"];
  const seen = new Set(queue);
  const out: Crawled[] = [];
  while (queue.length && out.length < MAX_PAGES) {
    const path = queue.shift()!;
    let res: Response;
    try {
      res = await fetch(BASE + path, { headers: { "user-agent": UA }, redirect: "follow" });
    } catch (error) {
      out.push({ path, status: 0, kind: "error", html: String(error) });
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    const html = type.includes("text/html") ? await res.text() : "";
    out.push({
      path,
      status: res.status,
      kind: res.ok && html ? classify(html, path) : "error",
      html,
    });
    if (html) {
      for (const link of extractLinks(html, BASE)) {
        if (!seen.has(link) && isCrawlable(link)) {
          seen.add(link);
          queue.push(link);
        }
      }
    }
    await sleep(DELAY_MS);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Existing data in the target Directus
// ---------------------------------------------------------------------------
interface PageRow {
  id: string;
  slug: string;
  parent: string | null;
  content: string | null;
  title: string;
}

async function loadTarget() {
  const [pages, articles, events, redirects, articleCategories, eventCategories] =
    await Promise.all([
      client.request(
        readItems("pages", { fields: ["id", "slug", "parent", "content", "title"], limit: -1 }),
      ),
      client.request(readItems("articles", { fields: ["slug"], limit: -1 })),
      client.request(readItems("events", { fields: ["title", "start_date", "slug"], limit: -1 })),
      client.request(readItems("redirects", { fields: ["from_path"], limit: -1 })),
      client.request(readItems("article_categories", { fields: ["id", "slug"], limit: -1 })),
      client.request(readItems("event_categories", { fields: ["id", "slug"], limit: -1 })),
    ]);
  const pageRows = pages as unknown as PageRow[];
  const byId = new Map(pageRows.map((p) => [p.id, p]));
  const pathOf = (p: PageRow): string => {
    const parts = [p.slug];
    let cur = p.parent ? byId.get(p.parent) : undefined;
    while (cur) {
      parts.unshift(cur.slug);
      cur = cur.parent ? byId.get(cur.parent) : undefined;
    }
    return `/${parts.join("/")}`;
  };
  return {
    pagesByPath: new Map(pageRows.map((p) => [pathOf(p), p])),
    articleSlugs: new Set((articles as { slug: string }[]).map((a) => a.slug)),
    events: events as { title: string; start_date: string; slug: string | null }[],
    redirectSources: new Set((redirects as { from_path: string }[]).map((r) => r.from_path)),
    defaultArticleCategory: (articleCategories as { id: number; slug: string }[]).find(
      (c) => c.slug === "allgemein",
    )?.id,
    eventCategories: new Map(
      (eventCategories as { id: number; slug: string }[]).map((c) => [c.slug, c.id]),
    ),
  };
}

// ---------------------------------------------------------------------------
// 3. Plan
// ---------------------------------------------------------------------------
type Action = "create" | "update" | "skip" | "redirect" | "manual";
interface PlanRow {
  kind: string;
  action: Action;
  from: string;
  to?: string;
  note?: string;
}

const isPlaceholder = (html: string | null) => !html || html.includes(PLACEHOLDER);

function eventCalendar(title: string) {
  return /bezirkstag|verband|versammlung/i.test(title) ? "general" : "swimming";
}
function eventCategorySlugs(title: string) {
  const slugs: string[] = [];
  if (/meisterschaft|wettkampf|cup|pokal|sprint/i.test(title)) slugs.push("wettkampf");
  if (/bezirkstag|verband|versammlung/i.test(title)) slugs.push("verband");
  if (/kampfrichter/i.test(title)) slugs.push("kampfrichter");
  return slugs;
}
const eventSlug = (e: ParsedEvent) => `${e.startDate}-${slugify(e.title, 80)}`;

// ---------------------------------------------------------------------------
// 4. Apply helpers
// ---------------------------------------------------------------------------
async function uploadAsset(
  path: string,
  folder: string,
  cache: Map<string, string>,
): Promise<string | null> {
  if (cache.has(path)) return cache.get(path)!;
  const marker = `joomla:${path}`;
  const existing = (await client.request(
    readFiles({ filter: { description: { _eq: marker } }, fields: ["id"], limit: 1 }),
  )) as { id: string }[];
  if (existing[0]) {
    cache.set(path, existing[0].id);
    return existing[0].id;
  }
  if (!APPLY) return null;
  const res = await fetch(BASE + encodeURI(path), { headers: { "user-agent": UA } });
  if (!res.ok) {
    failedFiles.push(`${path} (HTTP ${res.status})`);
    return null;
  }
  const name = decodeURIComponent(path.split("/").at(-1)!.split("?")[0]!);
  const form = new FormData();
  form.append("folder", folder);
  form.append("description", marker);
  form.append("title", name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "));
  form.append(
    "file",
    new Blob([await res.arrayBuffer()], { type: res.headers.get("content-type") ?? undefined }),
    name,
  );
  const file = (await client.request(uploadFiles(form))) as { id: string };
  cache.set(path, file.id);
  await sleep(DELAY_MS);
  return file.id;
}

async function main() {
  console.log(
    `${APPLY ? "IMPORT" : "DRY RUN (use --apply to write)"}: ${BASE} → ${process.env.DIRECTUS_URL}`,
  );
  const crawled = await crawl();
  console.log(`Crawled ${crawled.length} pages.\n`);
  const target = await loadTarget();
  const plan: PlanRow[] = [];
  const assets = new Map<string, string>();

  const articles: { path: string; a: ParsedArticle }[] = [];
  const pages: { path: string; p: ParsedPage }[] = [];
  const events: { path: string; e: ParsedEvent }[] = [];
  for (const c of crawled) {
    try {
      if (c.kind === "article") articles.push({ path: c.path, a: parseArticle(c.html) });
      else if (c.kind === "page") pages.push({ path: c.path, p: parsePage(c.html) });
      else if (c.kind === "event") events.push({ path: c.path, e: parseEvent(c.html, BASE) });
    } catch (error) {
      plan.push({
        kind: c.kind,
        action: "manual",
        from: c.path,
        note: `Parse error: ${(error as Error).message}`,
      });
    }
  }

  /** Routes of the new app – never CMS pages. The old home intro becomes page `startseite`. */
  const appRoutes = new Set([
    "/news",
    "/veranstaltungen",
    "/vereine",
    "/login",
    "/intern",
    "/kalender",
  ]);
  const pagePath = (path: string) => (path === "/" ? "/startseite" : path);
  const plannedFiles = new Set<string>();

  // Internal links keep their path – except events, whose URLs changed.
  const eventPaths = new Map(
    events.map(({ path, e }) => [path, `/veranstaltungen/${eventSlug(e)}`]),
  );
  const linkMap = (p: string) => eventPaths.get(p) ?? p;

  // --- Articles ----------------------------------------------------------------
  for (const { path, a } of articles) {
    const slug = path.split("/").at(-1)!;
    if (target.articleSlugs.has(slug)) {
      plan.push({ kind: "article", action: "skip", from: path, note: "exists" });
      continue;
    }
    plan.push({
      kind: "article",
      action: "create",
      from: path,
      to: `/news/${slug}`,
      note: a.title,
    });
    assetReferences(a.html, BASE).forEach((r) => plannedFiles.add(r));
    if (!APPLY) continue;
    for (const ref of assetReferences(a.html, BASE))
      await uploadAsset(ref, DIRECTUS_FOLDER_IDS.publicMedia, assets);
    await client.request(
      createItem("articles", {
        status: "published",
        published_at: a.publishedAt ?? new Date().toISOString(),
        title: a.title,
        slug,
        category: target.defaultArticleCategory,
        teaser: a.teaser,
        content: rewriteHtml(a.html, BASE, assets, linkMap),
        author_name: a.author,
      } as never),
    );
  }

  // --- Pages (parents first) ----------------------------------------------------
  for (const { path: oldPath, p } of pages.sort(
    (x, y) => x.path.split("/").length - y.path.split("/").length,
  )) {
    const path = pagePath(oldPath);
    if (appRoutes.has(path)) {
      plan.push({
        kind: "page",
        action: "skip",
        from: oldPath,
        note: "replaced by an app page of the new site",
      });
      continue;
    }
    const existing = target.pagesByPath.get(path);
    if (existing && !isPlaceholder(existing.content)) {
      plan.push({ kind: "page", action: "skip", from: path, note: "has content" });
      continue;
    }
    const parentPath = path.split("/").slice(0, -1).join("/");
    const parent = parentPath ? target.pagesByPath.get(parentPath) : undefined;
    if (!existing && parentPath && !parent) {
      plan.push({
        kind: "page",
        action: "manual",
        from: path,
        note: `parent ${parentPath} missing`,
      });
      continue;
    }
    plan.push({
      kind: "page",
      action: existing ? "update" : "create",
      from: oldPath,
      to: oldPath === "/" ? "/ (Seite startseite)" : path,
      note: existing ? p.title : `${p.title} (not in navigation yet)`,
    });
    assetReferences(p.html, BASE).forEach((r) => plannedFiles.add(r));
    if (!APPLY) continue;
    for (const ref of assetReferences(p.html, BASE))
      await uploadAsset(ref, DIRECTUS_FOLDER_IDS.pageDocuments, assets);
    const content = rewriteHtml(p.html, BASE, assets, linkMap);
    if (existing) {
      await client.request(updateItem("pages", existing.id, { title: p.title, content } as never));
    } else {
      const created = (await client.request(
        createItem("pages", {
          status: "published",
          visibility: "public",
          title: p.title,
          slug: path.split("/").at(-1),
          parent: parent?.id ?? null,
          content,
        } as never),
      )) as PageRow;
      target.pagesByPath.set(path, created);
    }
  }

  // --- Events -------------------------------------------------------------------
  const createdEvents = new Set<string>();
  for (const { path, e } of events) {
    const to = eventPaths.get(path)!;
    const existing = target.events.find((x) => x.title === e.title && x.start_date === e.startDate);
    if (existing || createdEvents.has(to)) {
      plan.push({
        kind: "event",
        action: "skip",
        from: path,
        note: existing ? "exists" : "same event, other URL",
      });
    } else {
      createdEvents.add(to);
      e.files.forEach((f) => plannedFiles.add(f.path));
      plan.push({
        kind: "event",
        action: "create",
        from: path,
        to,
        note: `${e.title} · ${eventCalendar(e.title)} · ${eventCategorySlugs(e.title).join(",") || "–"}`,
      });
      if (APPLY) {
        const files: { file: string; description: string; sort: number }[] = [];
        for (const [i, f] of e.files.entries()) {
          const id = await uploadAsset(f.path, DIRECTUS_FOLDER_IDS.pageDocuments, assets);
          if (id) files.push({ file: id, description: f.label, sort: i + 1 });
        }
        const allDay = !e.startTime;
        const created = (await client.request(
          createItem("events", {
            status: "published",
            slug: to.split("/").at(-1),
            published_at: new Date().toISOString(),
            title: e.title,
            description: e.description || null,
            start_date: e.startDate,
            end_date: e.endDate,
            all_day: allDay,
            start_time: allDay ? null : e.startTime,
            end_time: allDay ? null : e.endTime,
            calendar: eventCalendar(e.title),
            club: null,
            organizer_type: "federation",
            organizer_name: ORGANIZER,
            official: true,
            venue: e.venue,
            street: e.street,
            postal_code: e.postalCode,
            city: e.city,
            results_service: e.swimresultsId ? "SwimResults" : null,
            swimresults_id: e.swimresultsId,
            categories: eventCategorySlugs(e.title)
              .map((s) => target.eventCategories.get(s))
              .filter(Boolean)
              .map((id) => ({ event_categories_id: id })),
            files,
          } as never),
        )) as { id: string };
        await client.request(
          createItem("audit_logs", {
            actor: null,
            action: "event.created",
            entity_type: "events",
            entity_id: created.id,
            club: null,
            comment: "Import aus der alten Website (Joomla)",
            context: { title: e.title, source: BASE + path },
          } as never),
        );
      }
    }
    if (!target.redirectSources.has(path))
      plan.push({ kind: "event", action: "redirect", from: path, to });
  }

  // --- Lists / other pages ---------------------------------------------------------
  const served = (path: string) =>
    path === "/" || appRoutes.has(path) || target.pagesByPath.has(path);
  for (const c of crawled.filter(
    (x) => x.kind === "list" || x.kind === "other" || x.kind === "error",
  )) {
    const [bare, query] = c.path.split("?") as [string, string | undefined];
    if (c.kind === "error") {
      plan.push(
        served(bare)
          ? {
              kind: "error",
              action: "skip",
              from: c.path,
              note: `HTTP ${c.status} on the old site, served by the new site`,
            }
          : {
              kind: "error",
              action: "manual",
              from: c.path,
              note: `HTTP ${c.status} on the old site (broken link there)`,
            },
      );
    } else if (query && served(bare)) {
      // e.g. /news?start=10 (Joomla pagination) → list start page
      if (!target.redirectSources.has(c.path))
        plan.push({ kind: c.kind, action: "redirect", from: c.path, to: bare });
    } else if (served(bare)) {
      plan.push({ kind: c.kind, action: "skip", from: c.path, note: "served by the new site" });
    } else {
      plan.push({
        kind: c.kind,
        action: "manual",
        from: c.path,
        note: "no counterpart – add a page or redirect",
      });
    }
  }

  // --- Home banner photo -----------------------------------------------------------
  const home = crawled.find((c) => c.path === "/" && c.html);
  const banner = home ? parseHomeBanner(home.html, BASE) : null;
  if (banner) {
    const row = (await client.request(readSingleton("homepage", { fields: ["hero_image"] }))) as {
      hero_image: string | null;
    } | null;
    if (row?.hero_image) {
      plan.push({
        kind: "banner",
        action: "skip",
        from: banner.imagePath,
        note: "banner image already set",
      });
    } else {
      plan.push({
        kind: "banner",
        action: "update",
        from: banner.imagePath,
        to: "Startseite → Bild",
      });
      plannedFiles.add(banner.imagePath);
      if (APPLY) {
        const id = await uploadAsset(banner.imagePath, DIRECTUS_FOLDER_IDS.publicMedia, assets);
        if (id) await client.request(updateSingleton("homepage", { hero_image: id } as never));
      }
    }
  }

  // --- Redirects --------------------------------------------------------------------
  const redirects = plan.filter((r) => r.action === "redirect");
  if (APPLY && redirects.length) {
    await client.request(
      createItems(
        "redirects",
        redirects.map((r) => ({
          from_path: r.from,
          to_path: r.to,
          permanent: true,
          active: true,
          note: "Joomla-Migration",
        })) as never,
      ),
    );
  }

  for (const f of failedFiles) {
    plan.push({
      kind: "file",
      action: "manual",
      from: f,
      note: "missing on the old site – link stays broken",
    });
  }

  // --- Report -------------------------------------------------------------------------
  const order: Action[] = ["create", "update", "redirect", "manual", "skip"];
  plan.sort(
    (a, b) => order.indexOf(a.action) - order.indexOf(b.action) || a.from.localeCompare(b.from),
  );
  for (const r of plan) {
    console.log(
      `${r.action.padEnd(8)} ${r.kind.padEnd(7)} ${r.from}${r.to && r.to !== r.from ? ` → ${r.to}` : ""}${r.note ? `  (${r.note})` : ""}`,
    );
  }
  const count = (a: Action) => plan.filter((r) => r.action === a).length;
  console.log(
    `\n${APPLY ? "Done" : "Plan"}: ${count("create")} create, ${count("update")} update, ${count("redirect")} redirects, ` +
      `${count("manual")} need manual work, ${count("skip")} skipped. Files: ${APPLY ? assets.size : plannedFiles.size}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
