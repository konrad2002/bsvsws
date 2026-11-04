import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCard } from "@/components/public/news/article-card";
import { EventList } from "@/components/public/events/event-list-item";
import { RichContent } from "@/components/public/rich-content";
import { addDays, todayInBerlin } from "@/lib/calendar";
import { getPage, listArticles } from "@/lib/data/public-content";
import { listPublicEvents } from "@/lib/data/public-events";

/** Home (owner decision): editable intro (CMS page "startseite"), latest news, next events. */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-10">
      <Suspense
        fallback={<h1 className="text-2xl font-semibold">Bezirksschwimmverband Südwestsachsen</h1>}
      >
        <Intro />
      </Suspense>
      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="home-news" className="flex flex-col gap-4">
          <h2 id="home-news" className="text-xl font-semibold">
            News
          </h2>
          <Suspense fallback={<p className="text-sm">News werden geladen …</p>}>
            <LatestNews />
          </Suspense>
          <Link href="/news" className="text-sm underline">
            Alle News
          </Link>
        </section>
        <section aria-labelledby="home-events" className="flex flex-col gap-4">
          <h2 id="home-events" className="text-xl font-semibold">
            Nächste Veranstaltungen
          </h2>
          <Suspense fallback={<p className="text-sm">Veranstaltungen werden geladen …</p>}>
            <NextEvents />
          </Suspense>
          <Link href="/veranstaltungen" className="text-sm underline">
            Alle Veranstaltungen
          </Link>
        </section>
      </div>
    </div>
  );
}

async function Intro() {
  const page = await getPage("/startseite");
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">
        {page?.title ?? "Bezirksschwimmverband Südwestsachsen"}
      </h1>
      {page && <RichContent html={page.contentHtml} />}
    </section>
  );
}

async function LatestNews() {
  const { items } = await listArticles({ pageSize: 3 });
  if (items.length === 0) return <p className="text-sm text-neutral-600">Noch keine News.</p>;
  return (
    <div className="flex flex-col gap-6">
      {items.map((a) => (
        <ArticleCard key={a.slug} article={a} />
      ))}
    </div>
  );
}

async function NextEvents() {
  await connection(); // "today" must be computed per request, not at build time
  const today = todayInBerlin();
  const events = await listPublicEvents({ from: today, to: addDays(today, 365) });
  return <EventList events={events.slice(0, 5)} empty="Keine kommenden Veranstaltungen." />;
}
