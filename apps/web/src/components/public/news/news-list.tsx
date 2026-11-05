import Link from "next/link";
import { Pagination } from "@/components/public/pagination";
import { listArticleCategories, listArticles } from "@/lib/data/public-content";
import { ArticleCard } from "./article-card";

const PAGE_SIZE = 10;

export const parsePage = (value: string | string[] | undefined) => {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
};

/** News overview with category navigation and pagination (spec §8.2). */
export async function NewsList({ category, page }: { category?: string; page: number }) {
  const [articles, categories] = await Promise.all([
    listArticles({ category, page, pageSize: PAGE_SIZE }),
    listArticleCategories(),
  ]);
  const basePath = category ? `/news/kategorie/${category}` : "/news";
  return (
    <div className="flex flex-col gap-6">
      {categories.length > 1 && (
        <nav aria-label="Kategorien" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/news" aria-current={!category ? "page" : undefined} className="link">
            Alle
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/news/kategorie/${c.slug}`}
              aria-current={category === c.slug ? "page" : undefined}
              className="link"
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}
      {articles.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Artikel vorhanden.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {articles.items.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      )}
      <Pagination basePath={basePath} page={articles.page} pageCount={articles.pageCount} />
    </div>
  );
}
