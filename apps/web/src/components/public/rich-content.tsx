/**
 * Renders CMS HTML. The HTML is sanitized by the API (allowlist, asset URL
 * rewriting) – never pass unsanitized HTML here.
 */
export function RichContent({ html }: { html: string }) {
  if (!html) return null;
  return <div className="rich-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
