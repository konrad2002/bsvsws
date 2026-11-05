import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { RichContent } from "@/components/public/rich-content";
import { getPage, resolveRedirect } from "@/lib/data/public-content";

/**
 * Catch-all for hierarchical CMS pages (/verband/vorstand – same paths as the old
 * site, spec §9.6). Unmatched paths are looked up in the redirect table
 * (e.g. old Joomla URLs), otherwise 404. Specific routes (/news, /veranstaltungen,
 * /vereine, /intern, …) always take precedence.
 */
const toPath = (segments: string[]) => `/${segments.map((s) => decodeURIComponent(s)).join("/")}`;

export async function generateMetadata({ params }: PageProps<"/[...path]">): Promise<Metadata> {
  const { path } = await params;
  const page = await getPage(toPath(path));
  return page ? { title: page.title } : {};
}

/**
 * Real HTTP status codes (404 / 3xx) are resolved in Proxy before rendering
 * (src/proxy.ts). Loading data at the top level here is the fallback (and gives
 * correct codes in dev); `instant = false` allows this blocking render.
 */
export const instant = false;

export default async function CmsPage({ params, searchParams }: PageProps<"/[...path]">) {
  const [{ path: segments }, query] = await Promise.all([params, searchParams]);
  const path = toPath(segments);
  const page = await getPage(path);

  if (!page) {
    const search = new URLSearchParams(
      Object.entries(query).flatMap(([k, v]) =>
        Array.isArray(v) ? v.map((x) => [k, x]) : v !== undefined ? [[k, v]] : [],
      ),
    ).toString();
    const target = await resolveRedirect(path, search);
    if (target) (target.permanent ? permanentRedirect : redirect)(target.to);
    notFound();
  }

  return (
    <article className="flex flex-col gap-4">
      {page.breadcrumbs.length > 0 && (
        <nav aria-label="Brotkrumen" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap gap-1">
            {page.breadcrumbs.map((b) => (
              <li key={b.href} className="after:ml-1 after:content-['›']">
                <Link href={b.href} className="link">
                  {b.title}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <h1>{page.title}</h1>
      <RichContent html={page.contentHtml} />
      {page.children.length > 0 && (
        <nav aria-label="Unterseiten" className="mt-4">
          <ul className="grid gap-2 sm:grid-cols-2">
            {page.children.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="block rounded border px-3 py-2 hover:bg-muted">
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  );
}
