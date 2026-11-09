import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes editor HTML (Directus WYSIWYG) before it reaches the website.
 * Allowlist only – scripts, event handlers, inline styles, iframes and unknown
 * URL schemes are removed even if an editor account is compromised.
 *
 * Directus asset URLs (…/assets/<uuid>…) are rewritten to the public media
 * proxy `/medien/<uuid>`, which only serves files from the public media folder.
 */
const ASSET_URL = /^(?:https?:\/\/[^/]+)?\/assets\/([0-9a-f-]{36})(?:\.[a-z0-9]+)?(?:\?(.*))?$/i;

export function rewriteAssetUrl(url: string): string {
  const match = ASSET_URL.exec(url.trim());
  if (!match) return url;
  const width = new URLSearchParams(match[2] ?? "").get("width");
  return `/medien/${match[1]!.toLowerCase()}${width && /^\d{1,4}$/.test(width) ? `?width=${width}` : ""}`;
}

export function sanitizeContent(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: [
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "sub",
      "sup",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "figure",
      "figcaption",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "caption",
      "code",
      "pre",
      "span",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    transformTags: {
      // The page title is the only <h1>.
      h1: "h2",
      a: (tagName, attribs) => {
        const href = attribs.href ? rewriteAssetUrl(attribs.href) : attribs.href;
        const external = !!href && /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: {
            ...attribs,
            ...(href ? { href } : {}),
            ...(attribs.target === "_blank" || external ? { rel: "noopener noreferrer" } : {}),
          },
        };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.src ? { src: rewriteAssetUrl(attribs.src) } : {}),
          loading: "lazy",
        },
      }),
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  });
}
