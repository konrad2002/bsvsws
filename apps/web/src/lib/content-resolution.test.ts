import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { isContentPath, isDocumentRequest } = await import("./content-resolution");

describe("content path classification (proxy status codes)", () => {
  it.each([
    ["/verband/vorstand", true],
    ["/news/neue-webseite", true],
    ["/news/kategorie/berichte", true],
    ["/vereine/sv-musterstadt", true],
    ["/veranstaltungen/2027-05-08-bm", true],
    ["/index.php", true],
    ["/alte-seite.html", true],
    ["/sitemap.xml", false],
    ["/", false],
    ["/news", false],
    ["/veranstaltungen", false],
    ["/vereine", false],
    ["/login", false],
    ["/intern/veranstaltungen", false],
    ["/einladung/abc", false],
    ["/api/clubs/x/logo", false],
    ["/kalender/alle.ics", false],
    ["/medien/abc", false],
    ["/robots.txt", false],
  ])("%s → %s", (path, expected) => {
    expect(isContentPath(path)).toBe(expected);
  });

  it("only checks full page loads", () => {
    expect(isDocumentRequest(new Headers(), "GET")).toBe(true);
    expect(isDocumentRequest(new Headers({ rsc: "1" }), "GET")).toBe(false);
    expect(isDocumentRequest(new Headers({ "next-router-prefetch": "1" }), "GET")).toBe(false);
    expect(isDocumentRequest(new Headers(), "POST")).toBe(false);
  });
});
