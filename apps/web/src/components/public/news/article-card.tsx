import type { ArticleSummary } from "@bsv-sws/validation";
import Link from "next/link";
import { cn } from "@bsv-sws/ui/lib/utils";
import { formatPublishedDate } from "@/lib/format";

/** News teaser (list, home). `className="card"` renders it as a white box. */
export function ArticleCard({
  article,
  className,
}: {
  article: ArticleSummary;
  className?: string;
}) {
  return (
    <article className={cn("flex flex-col gap-3 sm:flex-row", className)}>
      {article.featuredImage && (
        // eslint-disable-next-line @next/next/no-img-element -- proxied CMS media with width transform
        <img
          src={`/medien/${article.featuredImage}?width=480`}
          alt=""
          loading="lazy"
          className="h-36 w-full object-cover sm:w-56"
        />
      )}
      <div className="flex flex-col gap-2">
        <h2>
          <Link href={`/news/${article.slug}`} className="hover:underline">
            {article.title}
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatPublishedDate(article.publishedAt)} ·{" "}
          <Link href={`/news/kategorie/${article.category.slug}`} className="link">
            {article.category.name}
          </Link>
        </p>
        {article.teaser && <p className="text-sm">{article.teaser}</p>}
        <Link href={`/news/${article.slug}`} className="link text-sm">
          › Weiterlesen
        </Link>
      </div>
    </article>
  );
}
