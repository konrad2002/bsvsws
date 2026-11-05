/**
 * Pure parsers for the public pages of the old Joomla site (bsv-sws.de, Joomla 4/5
 * with com_content + JEvents). No I/O – unit-tested against saved pages in
 * ./fixtures. Used by ../migrate-joomla.ts.
 */
import * as cheerio from "cheerio";

export type PageKind = "article" | "page" | "event" | "list" | "other";

/** Paths that are never content (Joomla internals, assets, feeds, login). */
const IGNORED = [
  /^\/(administrator|api|bin|cache|cli|components|includes|language|layouts|libraries|logs|media|modules|plugins|templates|tmp)(\/|$)/,
  /^\/component\//,
  /^\/(login|registrierung)(\/|$)/,
  /^\/images\//,
];

export const isAssetPath = (path: string) =>
  /^\/images\//.test(path) ||
  /\.(pdf|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|webp|svg|dsv[67]|lxf|lef)$/i.test(path);

/** Normalises an href to a same-site path (+query) or null for external/irrelevant links. */
export function sitePath(href: string, base: string): string | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  const origin = new URL(base);
  const host = (h: string) => h.replace(/^www\./, "");
  if (!/^https?:$/.test(url.protocol) || host(url.hostname) !== host(origin.hostname)) return null;
  if (url.searchParams.has("format") || url.searchParams.has("tmpl")) return null; // feeds, print views
  const path = decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";
  return path + url.search;
}

export function isCrawlable(path: string): boolean {
  const bare = path.split("?")[0]!;
  return !IGNORED.some((re) => re.test(bare)) && !isAssetPath(bare);
}

/** All same-site links of a page (navigation, content, sidebar). */
export function extractLinks(html: string, base: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href]").each((_, a) => {
    const p = sitePath($(a).attr("href")!, base);
    if (p) out.add(p);
  });
  return [...out];
}

export function classify(html: string, path: string): PageKind {
  const $ = cheerio.load(html);
  if ($("#jevents_body .jev_evdt").length) return "event";
  if ($(".com-content-category-blog, .com-content-category, #jevents_body").length) return "list";
  if ($(".com-content-article").length) return path.startsWith("/news/") ? "article" : "page";
  return "other";
}

const text = (s: string) => s.replace(/\s+/g, " ").trim();

/** Inner HTML of the article body with Joomla/page-builder wrappers removed. */
function cleanBody($: cheerio.CheerioAPI, body: ReturnType<cheerio.CheerioAPI>): string {
  body.find("script, style, form, .pagenav, .article-info").remove();
  // Unwrap layout-only containers (old page-builder markup: div/section with classes).
  let changed = true;
  while (changed) {
    changed = false;
    body.find("div, section").each((_, el) => {
      $(el).replaceWith($(el).contents());
      changed = true;
    });
  }
  body.find("*").each((_, el) => {
    const $el = $(el);
    for (const attr of [
      "class",
      "style",
      "id",
      "width",
      "height",
      "data-olk-copy-source",
      "itemprop",
    ]) {
      if (!(el.tagName === "img" && (attr === "width" || attr === "height"))) $el.removeAttr(attr);
    }
  });
  return (body.html() ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Longer opening paragraphs stay in the body; the article then has no teaser. */
export const TEASER_MAX = 400;

export interface ParsedArticle {
  title: string;
  publishedAt: string | null;
  author: string | null;
  html: string;
  teaser: string | null;
}

export function parseArticle(html: string): ParsedArticle {
  const $ = cheerio.load(html);
  const root = $(".com-content-article").first();
  // Articles have the menu heading ("News") as h1 and the article title as h2.
  const headers = root
    .find(".page-header")
    .map((_, h) => text($(h).text()))
    .get();
  const title = headers.at(-1) || text($("title").text());
  const publishedAt = root.find("dd.published time").attr("datetime") ?? null;
  const author = $('meta[name="author"]').attr("content")?.trim() || null;
  const body = root.find(".com-content-article__body").first();
  // Joomla had no separate intro: a short opening paragraph becomes the teaser (shown as
  // lead above the content) and is removed from the body so it doesn't appear twice.
  const first = body
    .children("p")
    .filter((_, p) => text($(p).text()).length > 0)
    .first();
  const firstText = text(first.text());
  let teaser: string | null = null;
  if (firstText && firstText.length <= TEASER_MAX && first.find("img, a").length === 0) {
    teaser = firstText;
    first.remove();
  }
  return { title, publishedAt, author, html: cleanBody($, body), teaser };
}

export interface ParsedPage {
  title: string;
  html: string;
}

export function parsePage(html: string): ParsedPage {
  const $ = cheerio.load(html);
  const root = $(".com-content-article").first();
  const title = text(root.find(".page-header").last().text()) || text($("title").text());
  return { title, html: cleanBody($, root.find(".com-content-article__body").first()) };
}

const MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

export interface ParsedEvent {
  title: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  description: string;
  swimresultsId: string | null;
  /** Files hosted on the old site (/images/…) → become event files. */
  files: { label: string; path: string }[];
}

/**
 * JEvents detail page. Summary formats seen on bsv-sws.de:
 *   "Vom Samstag, 18. April 2026 - 09:00 Bis Sonntag, 19. April 2026 - 17:00"
 *   "Samstag, 27. September 2025, 09:30 - 12:30"
 */
export function parseEvent(html: string, base: string): ParsedEvent {
  const $ = cheerio.load(html);
  const title = text($(".jev_evdt_title").first().text());
  const summary = text(
    $(".jev_evdt_summary")
      .first()
      .text()
      .replace(/\u00a0/g, " "),
  );
  const dates = [...summary.matchAll(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s+(\d{4})/g)].map((m) => {
    const month = MONTHS[m[2]!.toLowerCase()];
    if (!month) throw new Error(`Unknown month in "${summary}"`);
    return `${m[3]}-${String(month).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  });
  if (dates.length === 0) throw new Error(`No date in event summary "${summary}" (${title})`);
  const times = [...summary.matchAll(/\b(\d{1,2}):(\d{2})\b/g)].map(
    (m) => `${m[1]!.padStart(2, "0")}:${m[2]}:00`,
  );

  // Source line breaks are insignificant in HTML; only <br>/<p>/<li> create lines below.
  const $d = cheerio.load(
    ($(".jev_evdt_desc").first().html() ?? "").replace(/\s*\n\s*/g, " "),
    null,
    false,
  );
  const desc = $d.root();
  const swimresultsId =
    desc
      .find('a[href*="app.swimresults.de/m/"]')
      .first()
      .attr("href")
      ?.match(/\/m\/([A-Za-z0-9_-]+)/)?.[1] ?? null;

  // Files on the old server become event files; external file tiles stay links in the text.
  const files: ParsedEvent["files"] = [];
  desc.find("a[href]").each((_, a) => {
    const p = sitePath($d(a).attr("href")!, base);
    if (p && isAssetPath(p.split("?")[0]!)) {
      const label =
        text($d(a).find(".file-tile-name").text() || $d(a).text()) || p.split("/").at(-1)!;
      files.push({ label, path: p });
    }
  });

  // Plain-text description (events store text, not HTML – docs/03-data-model.md).
  desc
    .find(".file-tile-badge, .btn-download, .file-extension, .file-tile-icon, img, script, form")
    .remove();
  desc.find(".file-inactive").remove();
  desc.find("a[href]").each((_, a) => {
    const href = $d(a).attr("href")!;
    const p = sitePath(href, base);
    const label = text($d(a).text());
    if (p && isAssetPath(p.split("?")[0]!))
      $d(a).replaceWith(label ? `${label} (siehe Dateien)` : "");
    else if (/^https?:/.test(href) && label && !label.includes(href))
      $d(a).replaceWith(`${label}: ${href}`);
  });
  desc.find("br").replaceWith("\n");
  desc.find("p, h1, h2, h3, h4, div.file-tile").each((_, el) => {
    $d(el).prepend("\n").append("\n");
  });
  desc.find("li").each((_, el) => {
    $d(el).prepend("\n- ");
  });
  const lines = desc
    .text()
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim());

  // "Ort:" either inline ("Ort: Schwimmhalle X") or followed by address lines.
  let venueLines: string[] = [];
  const ortIdx = lines.findIndex((l) => /^Ort\s*:/i.test(l));
  if (ortIdx >= 0) {
    const inline = lines[ortIdx]!.replace(/^Ort\s*:\s*/i, "");
    let end = ortIdx + 1;
    if (inline) venueLines = [inline];
    else {
      while (end < lines.length && lines[end]) venueLines.push(lines[end++]!);
    }
    lines.splice(ortIdx, inline ? 1 : end - ortIdx);
  }
  const cityIdx = venueLines.findIndex((l) => /^\d{5}\s+\S/.test(l));
  const cityLine = cityIdx >= 0 ? venueLines[cityIdx]!.match(/^(\d{5})\s+(.+)$/) : null;
  const street = cityIdx > 1 ? venueLines[cityIdx - 1]! : null;

  const description = lines
    .join("\n")
    .replace(/^Dateien$/m, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    title,
    startDate: dates[0]!,
    endDate: dates[1] ?? dates[0]!,
    startTime: times[0] ?? null,
    endTime: times[1] ?? null,
    venue: venueLines[0] ?? null,
    street,
    postalCode: cityLine?.[1] ?? null,
    city: cityLine?.[2] ?? null,
    description,
    swimresultsId,
    files,
  };
}

/** Old-site files referenced by an HTML fragment (images + downloads under /images/). */
export function assetReferences(html: string, base: string): string[] {
  const $ = cheerio.load(html, null, false);
  const out = new Set<string>();
  $("img[src], a[href]").each((_, el) => {
    const raw = $(el).attr("src") ?? $(el).attr("href")!;
    const p = sitePath(raw, base);
    if (p && isAssetPath(p.split("?")[0]!)) out.add(p);
  });
  return [...out];
}

/**
 * Rewrites asset URLs (→ `/assets/<id>`, turned into `/medien/<id>` by the API
 * sanitizer) and internal links (→ the new paths, mostly identical).
 */
export function rewriteHtml(
  html: string,
  base: string,
  assets: Map<string, string>,
  linkMap: (path: string) => string,
): string {
  const $ = cheerio.load(html, null, false);
  $("img[src], a[href]").each((_, el) => {
    const attr = el.tagName === "img" ? "src" : "href";
    const raw = $(el).attr(attr)!;
    const p = sitePath(raw, base);
    if (!p) return;
    const id = assets.get(p);
    if (id) $(el).attr(attr, `/assets/${id}`);
    else if (!isAssetPath(p.split("?")[0]!)) $(el).attr(attr, linkMap(p));
  });
  return $.html();
}

/** Photo of the home banner (mod_bsv_banner: CSS background-image) → path on the old site. */
export function parseHomeBanner(html: string, base: string): { imagePath: string } | null {
  const $ = cheerio.load(html);
  const style = $(".bsv-banner-image-container").first().attr("style") ?? "";
  const url = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/)?.[1];
  const path = url ? sitePath(url, base) : null;
  return path ? { imagePath: path } : null;
}
