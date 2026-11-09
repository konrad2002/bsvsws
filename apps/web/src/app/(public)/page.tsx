import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EventList } from "@/components/public/events/event-list-item";
import { HomeHero } from "@/components/public/home-hero";
import { ArticleCard } from "@/components/public/news/article-card";
import { RichContent } from "@/components/public/rich-content";
import { addDays, todayInBerlin } from "@/lib/calendar";
import { getHome, getPage, listArticles } from "@/lib/data/public-content";
import { listPublicEvents } from "@/lib/data/public-events";

/**
 * Home (owner decisions): banner managed in Studio, editable intro (CMS page
 * "startseite"), latest news, next events.
 */
export default function HomePage() {
  return (
    <>
      <Suspense fallback={<div className="min-h-56 bg-hero" />}>
        <Hero />
      </Suspense>
      <div className="page-padding flex flex-col gap-10">
        <Suspense fallback={<h1>Bezirksschwimmverband Südwestsachsen</h1>}>
          <Intro />
        </Suspense>
        <section aria-labelledby="home-news" className="flex flex-col gap-4">
          <h2 id="home-news">News</h2>
          <Suspense fallback={<p className="text-sm">News werden geladen …</p>}>
            <LatestNews />
          </Suspense>
          <Link href="/news" className="link text-sm">
            Alle News
          </Link>
        </section>
        <section aria-labelledby="home-events" className="flex flex-col gap-4">
          <h2 id="home-events">Nächste Veranstaltungen</h2>
          <div className="card">
            <Suspense fallback={<p className="text-sm">Veranstaltungen werden geladen …</p>}>
              <NextEvents />
            </Suspense>
          </div>
          <Link href="/veranstaltungen" className="link text-sm">
            Alle Veranstaltungen
          </Link>
        </section>
      </div>
    </>
  );
}

async function Hero() {
  const { hero } = await getHome();
  return hero ? <HomeHero hero={hero} /> : null;
}

async function Intro() {
  const page = await getPage("/startseite");
  return (
    <section className="flex flex-col gap-4">
      <h1>{page?.title ?? "Bezirksschwimmverband Südwestsachsen"}</h1>
      {page && <RichContent html={page.contentHtml} />}
    </section>
  );
}

async function LatestNews() {
  const { items } = await listArticles({ pageSize: 3 });
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Noch keine News.</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {items.map((a) => (
        <ArticleCard key={a.slug} article={a} className="card" />
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
