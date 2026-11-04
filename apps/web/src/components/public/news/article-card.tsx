import type { ArticleSummary } from "@bsv-sws/validation";
import Link from "next/link";
import { formatPublishedDate } from "@/lib/format";

export function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <article className="flex flex-col gap-3 sm:flex-row">
      {article.featuredImage && (
        // eslint-disable-next-line @next/next/no-img-element -- proxied CMS media with width transform
        <img
          src={`/medien/${article.featuredImage}?width=480`}
          alt=""
          loading="lazy"
          className="h-36 w-full rounded object-cover sm:w-56"
        />
      )}
      <div className="flex flex-col gap-1">
        <p className="text-xs text-neutral-600">
          {formatPublishedDate(article.publishedAt)} ·{" "}
          <Link href={`/news/kategorie/${article.category.slug}`} className="hover:underline">
            {article.category.name}
          </Link>
        </p>
        <h2 className="text-lg font-semibold">
          <Link href={`/news/${article.slug}`} className="hover:underline">
            {article.title}
          </Link>
        </h2>
        {article.teaser && <p className="text-sm text-neutral-700">{article.teaser}</p>}
        <Link href={`/news/${article.slug}`} className="text-sm underline">
          Weiterlesen
        </Link>
      </div>
    </article>
  );
}
