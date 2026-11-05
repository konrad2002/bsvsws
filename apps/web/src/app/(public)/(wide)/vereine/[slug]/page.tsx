import { EVENT_CALENDAR_LABELS } from "@bsv-sws/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventList } from "@/components/public/events/event-list-item";
import { addDays, todayInBerlin } from "@/lib/calendar";
import { getClub } from "@/lib/data/public-content";
import { listPublicEvents } from "@/lib/data/public-events";

const validSlug = (s: string) => /^[a-z0-9-]{1,80}$/.test(s);

export async function generateMetadata({
  params,
}: PageProps<"/vereine/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const club = validSlug(slug) ? await getClub(slug) : null;
  return { title: club?.name ?? "Verein" };
}

/**
 * Club page generated from the club record (spec §6.2, §8.6) – no duplicate manual content.
 * Real HTTP status codes are resolved in Proxy before rendering (src/proxy.ts);
 * the top-level check here is the fallback.
 */
export const instant = false;

export default async function ClubPage({ params }: Pick<PageProps<"/vereine/[slug]">, "params">) {
  const { slug } = await params;
  const club = validSlug(slug) ? await getClub(slug) : null;
  if (!club) notFound();
  const today = todayInBerlin();
  const events = await listPublicEvents({ from: today, to: addDays(today, 365), club: club.slug });
  const address = [club.street, [club.postalCode, club.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link href="/vereine" className="text-sm link">
        ← Alle Vereine
      </Link>
      <header className="flex items-center gap-4">
        {club.hasLogo && (
          // eslint-disable-next-line @next/next/no-img-element -- proxied club logo
          <img
            src={`/api/clubs/${club.id}/logo`}
            alt={`Logo ${club.name}`}
            className="h-20 w-20 object-contain"
          />
        )}
        <h1>{club.name}</h1>
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {club.sports.length > 0 && (
          <>
            <dt className="font-medium">Sportarten</dt>
            <dd>{club.sports.map((s) => EVENT_CALENDAR_LABELS[s]).join(", ")}</dd>
          </>
        )}
        {address && (
          <>
            <dt className="font-medium">Adresse</dt>
            <dd>{address}</dd>
          </>
        )}
        {club.venue && (
          <>
            <dt className="font-medium">Trainingsstätte</dt>
            <dd className="whitespace-pre-line">{club.venue}</dd>
          </>
        )}
        {club.website && (
          <>
            <dt className="font-medium">Website</dt>
            <dd>
              <a
                href={club.website}
                className="break-all link"
                rel="noopener noreferrer"
                target="_blank"
              >
                {club.website}
              </a>
            </dd>
          </>
        )}
        {club.email && (
          <>
            <dt className="font-medium">E-Mail</dt>
            <dd>
              <a href={`mailto:${club.email}`} className="link">
                {club.email}
              </a>
            </dd>
          </>
        )}
        {club.phone && (
          <>
            <dt className="font-medium">Telefon</dt>
            <dd>{club.phone}</dd>
          </>
        )}
      </dl>
      {club.description && <p className="whitespace-pre-line">{club.description}</p>}
      <section aria-labelledby="club-events" className="flex flex-col gap-2">
        <h2 id="club-events">Kommende Veranstaltungen</h2>
        <EventList events={events} empty="Keine kommenden Veranstaltungen." />
      </section>
    </div>
  );
}
