import { describe, expect, it } from "vitest";
import { rewriteAssetUrl, sanitizeContent } from "./sanitize.js";

const ID = "0f7c6a2e-1b2c-4d3e-8f90-a1b2c3d4e5f6";

describe("sanitizeContent", () => {
  it("keeps editorial formatting", () => {
    const html =
      '<h2>Titel</h2><p><strong>fett</strong> <em>kursiv</em></p><ul><li>a</li></ul><table><tr><td colspan="2">x</td></tr></table>';
    expect(sanitizeContent(html)).toBe(html.replace("<table><tr>", "<table><tr>"));
  });

  it("removes scripts, event handlers, styles, iframes and dangerous URLs", () => {
    const out = sanitizeContent(
      '<p onclick="alert(1)" style="color:red">x</p><script>alert(1)</script><iframe src="https://evil"></iframe>' +
        '<a href="javascript:alert(1)">j</a><img src="data:image/png;base64,AAA" onerror="alert(1)"><a href="//evil.example">p</a>',
    );
    expect(out).not.toMatch(/script|onclick|onerror|style=|iframe|javascript:|data:|\/\/evil/);
    expect(out).toContain("<p>x</p>");
  });

  it("turns h1 into h2 and secures external links", () => {
    const out = sanitizeContent(
      '<h1>A</h1><a href="https://dsv.de" target="_blank">DSV</a><a href="/news">intern</a>',
    );
    expect(out).toContain("<h2>A</h2>");
    expect(out).toContain(
      '<a href="https://dsv.de" target="_blank" rel="noopener noreferrer">DSV</a>',
    );
    expect(out).toContain('<a href="/news">intern</a>');
  });

  it("rewrites Directus asset URLs to the public media proxy", () => {
    const out = sanitizeContent(
      `<img src="http://localhost:8055/assets/${ID}.jpg?width=800&access_token=secret" alt="Bild"><a href="/assets/${ID}">PDF</a>`,
    );
    expect(out).toContain(`<img src="/medien/${ID}?width=800" alt="Bild" loading="lazy" />`);
    expect(out).toContain(`<a href="/medien/${ID}">PDF</a>`);
    expect(out).not.toContain("access_token");
  });

  it("handles empty content", () => {
    expect(sanitizeContent(null)).toBe("");
  });
});

describe("rewriteAssetUrl", () => {
  it("only rewrites asset URLs", () => {
    expect(rewriteAssetUrl("https://example.com/x.jpg")).toBe("https://example.com/x.jpg");
    expect(rewriteAssetUrl(`https://cms.bsv-sws.de/assets/${ID}?width=99999`)).toBe(
      `/medien/${ID}`,
    );
  });
});
