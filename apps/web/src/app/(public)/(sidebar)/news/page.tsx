import type { Metadata } from "next";
import { Suspense } from "react";
import { NewsList, parsePage } from "@/components/public/news/news-list";

export const metadata: Metadata = {
  title: "News",
  description: "Neuigkeiten aus dem Bezirksschwimmverband Südwestsachsen.",
};

export default function NewsPage({ searchParams }: PageProps<"/news">) {
  return (
    <div className="flex flex-col gap-6">
      <h1>News</h1>
      <Suspense fallback={<p>News werden geladen …</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/news">, "searchParams">) {
  const { seite } = await searchParams;
  return <NewsList page={parsePage(seite)} />;
}
