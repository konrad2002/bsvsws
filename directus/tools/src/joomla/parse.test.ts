import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
  sitePath,
} from "./parse.js";

const BASE = "https://bsv-sws.de";
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8");

describe("Joomla parsers (saved pages of bsv-sws.de)", () => {
  it("normalises links and skips Joomla internals, assets and feeds", () => {
    expect(sitePath("/verband/vorstand/", BASE)).toBe("/verband/vorstand");
    expect(sitePath("https://www.bsv-sws.de/news", BASE)).toBe("/news");
    expect(sitePath("https://logilutions.de", BASE)).toBeNull();
    expect(sitePath("/news?format=feed&type=rss", BASE)).toBeNull();
    expect(sitePath("mailto:info@bsv-sws.de", BASE)).toBeNull();
    expect(isCrawlable("/component/users/reset?Itemid=101")).toBe(false);
    expect(isCrawlable("/images/bilder/x.jpg")).toBe(false);
    expect(isCrawlable("/kalender/eventdetail/20/-/bm-2026")).toBe(true);
    const links = extractLinks(fixture("article"), BASE);
    expect(links).toContain("/verband/vorstand");
    expect(links).toContain("/news/sichtungstraining-am-landesstuetzpunkt-schwimmen-chemnitz");
  });

  it("classifies pages", () => {
    expect(classify(fixture("article"), "/news/bericht-esbjerg-2025")).toBe("article");
    expect(classify(fixture("page"), "/verband/vorstand")).toBe("page");
    expect(classify(fixture("event"), "/kalender/eventdetail/20/-/x")).toBe("event");
    expect(classify(fixture("news-list"), "/news")).toBe("list");
  });

  it("parses a news article", () => {
    const a = parseArticle(fixture("article"));
    expect(a.title).toBe("Wettkampffahrt zum 26. Danish International Swim Cup nach Esbjerg");
    expect(a.publishedAt).toBe("2025-06-01T13:24:26+00:00");
    expect(a.author).toBe("Konrad Weiß");
    expect(a.teaser).toMatch(/^Es ist ein fester Bestandteil/);
    // moved, not copied: the lead must not appear twice on the article page
    expect(a.html).not.toContain("Es ist ein fester Bestandteil");
    expect(a.html).toMatch(/^<p><img/);
    expect(a.html).toContain('<img src="/images/bilder/2025/esbjerg/disc_2025-2.jpg"');
    expect(a.html).not.toMatch(/class=|style=|<script/);
    expect(assetReferences(a.html, BASE)).toContain("/images/bilder/2025/esbjerg/disc_2025-2.jpg");
  });

  it("parses a page and unwraps page-builder markup", () => {
    const p = parsePage(fixture("page"));
    expect(p.title).toBe("Vorstand & Fachwarte");
    expect(p.html).toContain("<h2>Vorstand</h2>");
    expect(p.html).toContain("<td>Uwe Albert</td>");
    expect(p.html).not.toMatch(/<div|<section|class=/);
  });

  it("parses a multi-day event with SwimResults and external files", () => {
    const e = parseEvent(fixture("event"), BASE);
    expect(e).toMatchObject({
      title: "Bezirksmeisterschaften 2026",
      startDate: "2026-04-18",
      endDate: "2026-04-19",
      startTime: "09:00:00",
      endTime: "17:00:00",
      venue: 'Schwimmhalle "Glück Auf" Zwickau',
      swimresultsId: "BMSWS26",
    });
    expect(e.description).toContain("Einlass: ab 9 Uhr");
    expect(e.description).toContain(
      "Ausschreibung: https://download.swimresults.de/BMSWS26/Ausschreibung_BM_2026.pdf",
    );
    expect(e.description).toContain(
      "- Livetiming: https://app.swimresults.de/m/BMSWS26/live?live=1",
    );
    expect(e.description).not.toMatch(/Ort:|LENEX Ergebnisdatei|<\w/);
    expect(e.files).toEqual([]);
  });

  it("parses a single-day event with address and a local file", () => {
    const e = parseEvent(fixture("event-single-day"), BASE);
    expect(e).toMatchObject({
      title: "Bezirkstag 2025",
      startDate: "2025-09-27",
      endDate: "2025-09-27",
      startTime: "09:30:00",
      endTime: "12:30:00",
      venue: "Felsendome Rabenstein",
      street: "Weg nach dem Kalkwerk 4",
      postalCode: "09117",
      city: "Chemnitz",
      files: [
        {
          label: "Einberufung Bezirkstag 2025",
          path: "/images/dateien/2025/Bezirkstag_2025_BSV-SWS.pdf",
        },
      ],
    });
    expect(e.description).toContain("Einberufung Bezirkstag 2025 (siehe Dateien)");
    expect(e.description).not.toContain("Felsendome");
  });

  it("rewrites assets to Directus and internal links to new paths", () => {
    const html =
      '<p><img src="/images/a.jpg"><a href="https://bsv-sws.de/verband/satzung/">S</a><a href="https://x.de">X</a></p>';
    const out = rewriteHtml(html, BASE, new Map([["/images/a.jpg", "abc"]]), (p) => `/neu${p}`);
    expect(out).toBe(
      '<p><img src="/assets/abc"><a href="/neu/verband/satzung">S</a><a href="https://x.de">X</a></p>',
    );
  });

  it("finds the home banner photo", () => {
    expect(parseHomeBanner(fixture("home"), BASE)).toEqual({
      imagePath: "/images/bilder/Plauener_Herbst_Mehrkampf-285-scaled.jpg",
    });
    expect(parseHomeBanner(fixture("page"), BASE)).toBeNull();
  });

  it("drops embedded Joomla modules (old home page: news flash + latest events)", () => {
    const home = parsePage(fixture("home"));
    expect(home.title).toBe("Willkommen beim BSV-SWS!");
    expect(home.html).toBe("");
  });
});
