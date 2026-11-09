import Link from "next/link";
import { Suspense } from "react";
import { listArticles } from "@/lib/data/public-content";

/** Right sidebar "Neuigkeiten" of bsv-sws.de: latest news with teaser. */
export function NewsSidebar() {
  return (
    <aside aria-labelledby="sidebar-news" className="hidden bg-background px-6 py-8 md:block">
      <h2 id="sidebar-news" className="text-heading-1">
        Neuigkeiten
      </h2>
      <Suspense>
        <LatestNews />
      </Suspense>
    </aside>
  );
}

async function LatestNews() {
  const { items } = await listArticles({ pageSize: 3 });
  return (
    <ul className="mt-4 flex flex-col divide-y">
      {items.map((a) => (
        <li key={a.slug} className="flex flex-col gap-2 py-5 first:pt-0">
          <h3 className="text-heading-2">
            <Link href={`/news/${a.slug}`} className="hover:underline">
              {a.title}
            </Link>
          </h3>
          {a.teaser && <p className="line-clamp-6 text-sm text-page-foreground">{a.teaser}</p>}
        </li>
      ))}
    </ul>
  );
}
