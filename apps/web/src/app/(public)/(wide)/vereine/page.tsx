import { EVENT_CALENDAR_LABELS } from "@bsv-sws/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listClubs } from "@/lib/data/public-content";

export const metadata: Metadata = {
  title: "Vereine",
  description: "Die Vereine im Bezirksschwimmverband Südwestsachsen.",
};

export default function ClubsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1>Vereine</h1>
      <Suspense fallback={<p>Vereine werden geladen …</p>}>
        <ClubList />
      </Suspense>
    </div>
  );
}

async function ClubList() {
  const clubs = await listClubs();
  if (clubs.length === 0) return <p className="text-sm text-muted-foreground">Keine Vereine.</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clubs.map((club) => (
        <li key={club.slug} className="flex items-center gap-3 rounded border p-3">
          {club.hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- proxied club logo
            <img
              src={`/api/clubs/${club.id}/logo`}
              alt=""
              className="h-12 w-12 shrink-0 object-contain"
              loading="lazy"
            />
          ) : (
            <span className="h-12 w-12 shrink-0 rounded bg-muted" aria-hidden />
          )}
          <div className="flex flex-col">
            <Link href={`/vereine/${club.slug}`} className="font-medium link">
              {club.name}
            </Link>
            <span className="text-xs text-muted-foreground">
              {[club.city, club.sports.map((s) => EVENT_CALENDAR_LABELS[s]).join(", ")]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
