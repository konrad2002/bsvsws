import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsList, parsePage } from "@/components/public/news/news-list";
import { listArticleCategories } from "@/lib/data/public-content";

export const metadata: Metadata = { title: "News" };

/**
 * Real HTTP status codes (404 / 3xx) are resolved in Proxy before rendering
 * (src/proxy.ts). Loading data at the top level here is the fallback (and gives
 * correct codes in dev); `instant = false` allows this blocking render.
 */
export const instant = false;

export default async function NewsCategoryPage({
  params,
  searchParams,
}: PageProps<"/news/kategorie/[slug]">) {
  const [{ slug }, { seite }, categories] = await Promise.all([
    params,
    searchParams,
    listArticleCategories(),
  ]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  return (
    <div className="flex flex-col gap-6">
      <h1>News: {category.name}</h1>
      <NewsList category={category.slug} page={parsePage(seite)} />
    </div>
  );
}
