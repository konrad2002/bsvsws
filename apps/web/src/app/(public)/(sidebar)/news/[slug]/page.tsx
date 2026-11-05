import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichContent } from "@/components/public/rich-content";
import { getArticle } from "@/lib/data/public-content";
import { formatPublishedDate } from "@/lib/format";

const validSlug = (s: string) => /^[a-z0-9-]{1,120}$/.test(s);

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = validSlug(slug) ? await getArticle(slug) : null;
  return article
    ? { title: article.title, description: article.teaser ?? undefined }
    : { title: "News" };
}

/**
 * Real HTTP status codes (404 / 3xx) are resolved in Proxy before rendering
 * (src/proxy.ts). Loading data at the top level here is the fallback (and gives
 * correct codes in dev); `instant = false` allows this blocking render.
 */
export const instant = false;

export default async function ArticlePage({ params }: Pick<PageProps<"/news/[slug]">, "params">) {
  const { slug } = await params;
  const article = validSlug(slug) ? await getArticle(slug) : null;
  if (!article) notFound();
  return (
    <article className="flex flex-col gap-5">
      <Link href="/news" className="text-sm link">
        ← Alle News
      </Link>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {formatPublishedDate(article.publishedAt)} ·{" "}
          <Link href={`/news/kategorie/${article.category.slug}`} className="link">
            {article.category.name}
          </Link>
          {article.author ? ` · ${article.author}` : ""}
        </p>
        <h1>{article.title}</h1>
      </header>
      {article.featuredImage && (
        // eslint-disable-next-line @next/next/no-img-element -- proxied CMS media with width transform
        <img
          src={`/medien/${article.featuredImage}?width=1200`}
          alt=""
          className="max-h-96 w-full rounded object-cover"
        />
      )}
      {article.teaser && <p className="font-medium">{article.teaser}</p>}
      <RichContent html={article.contentHtml} />
    </article>
  );
}
