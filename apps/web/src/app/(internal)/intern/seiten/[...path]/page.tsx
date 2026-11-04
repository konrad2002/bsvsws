import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { NoAccess } from "@/components/internal/notices";
import { RichContent } from "@/components/public/rich-content";
import { requireUser } from "@/lib/auth/current-user";
import { getInternalPage } from "@/lib/data/internal-content";

/**
 * Protected CMS pages (visibility Verein / Vereinsvertreter / Verband) live in the
 * internal area (owner decision). Status codes (403/404, public redirect) are
 * resolved in Proxy before rendering; this page renders the result.
 */
const toPath = (segments: string[]) => `/${segments.map((s) => decodeURIComponent(s)).join("/")}`;

export const metadata: Metadata = { title: "Interner Bereich", robots: { index: false } };
export const instant = false;

export default async function InternalCmsPage({ params }: PageProps<"/intern/seiten/[...path]">) {
  const { path: segments } = await params;
  const path = toPath(segments);
  await requireUser(`/intern/seiten${path}`);
  const result = await getInternalPage(path);
  if (!result) notFound();
  if ("forbidden" in result) {
    // Deliberately no title or content (owner decision: 403 without details).
    return <NoAccess>Dafür fehlt dir die Berechtigung.</NoAccess>;
  }
  const { page } = result;
  if (page.visibility === "public") permanentRedirect(page.href);

  return (
    <article className="flex max-w-3xl flex-col gap-4">
      {page.breadcrumbs.length > 0 && (
        <nav aria-label="Brotkrumen" className="text-sm text-neutral-600">
          <ol className="flex flex-wrap gap-1">
            {page.breadcrumbs.map((b) => (
              <li key={b.href} className="after:ml-1 after:content-['›']">
                <Link href={b.href} className="hover:underline">
                  {b.title}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <h1 className="text-2xl font-semibold">{page.title}</h1>
      <RichContent html={page.contentHtml} />
      {page.children.length > 0 && (
        <nav aria-label="Unterseiten" className="mt-4">
          <ul className="grid gap-2 sm:grid-cols-2">
            {page.children.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="block rounded border px-3 py-2 hover:bg-neutral-50">
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
