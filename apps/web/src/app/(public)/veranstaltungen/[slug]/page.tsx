import { EVENT_CALENDAR_LABELS, SCHEDULE_ENTRY_TYPE_LABELS } from "@bsv-sws/shared";
import type { PublicEventDetail } from "@bsv-sws/validation";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eventTime } from "@/components/public/events/event-list-item";
import { getPublicEvent } from "@/lib/data/public-events";
import { formatDate, formatDateRange, formatFileSize } from "@/lib/format";

const validSlug = (slug: string) => /^[a-z0-9-]{1,120}$/.test(slug);

export async function generateMetadata({
  params,
}: PageProps<"/veranstaltungen/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = validSlug(slug) ? await getPublicEvent(slug) : null;
  if (!event) return { title: "Veranstaltung nicht gefunden" };
  return {
    title: event.title,
    description: `${formatDateRange(event.startDate, event.endDate)} · ${[event.venue, event.city].filter(Boolean).join(", ")}`,
  };
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-medium">{label}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </>
  );
}

/**
 * Real HTTP status codes (404 / 3xx) are resolved in Proxy before rendering
 * (src/proxy.ts). Loading data at the top level here is the fallback (and gives
 * correct codes in dev); `instant = false` allows this blocking render.
 */
export const instant = false;

export default async function PublicEventPage({
  params,
}: Pick<PageProps<"/veranstaltungen/[slug]">, "params">) {
  const { slug } = await params;
  const event = validSlug(slug) ? await getPublicEvent(slug) : null;
  if (!event) notFound();
  const time = eventTime(event);
  const address = [event.street, [event.postalCode, event.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const multiDay = event.startDate !== event.endDate;

  return (
    <article className="flex max-w-3xl flex-col gap-6">
      <Link href="/veranstaltungen" className="text-sm hover:underline">
        ← Alle Veranstaltungen
      </Link>
      {event.hasTitleImage && (
        // eslint-disable-next-line @next/next/no-img-element -- proxied asset, sizes unknown
        <img
          src={`/api/events/${event.id}/images/title_image?v=${event.updatedAt}`}
          alt=""
          className="max-h-80 w-full rounded object-cover"
        />
      )}
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{event.title}</h1>
          <p className="text-neutral-700">
            {formatDateRange(event.startDate, event.endDate)}
            {time ? `, ${time}` : ""}
          </p>
        </div>
        {event.hasLogo && (
          // eslint-disable-next-line @next/next/no-img-element -- proxied asset
          <img
            src={`/api/events/${event.id}/images/logo?v=${event.updatedAt}`}
            alt="Logo"
            className="h-20 w-20 object-contain"
          />
        )}
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <Info label="Kalender">
          {[EVENT_CALENDAR_LABELS[event.calendar], ...event.categories.map((c) => c.name)].join(
            " · ",
          )}
        </Info>
        <Info label="Veranstalter">{event.organizer}</Info>
        {(event.venue || address) && (
          <Info label="Ort">{[event.venue, address].filter(Boolean).join("\n")}</Info>
        )}
        {event.website && (
          <Info label="Website">
            <a
              href={event.website}
              className="break-all underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              {event.website}
            </a>
          </Info>
        )}
        {event.resultsService && <Info label="Ergebnisdienst">{event.resultsService}</Info>}
      </dl>

      {event.description && <p className="whitespace-pre-line">{event.description}</p>}

      {event.admissionInfo && (
        <section aria-labelledby="zulassung" className="flex flex-col gap-1">
          <h2 id="zulassung" className="text-lg font-semibold">
            Zulassung / Meldung
          </h2>
          <p className="whitespace-pre-line text-sm">{event.admissionInfo}</p>
        </section>
      )}

      {event.schedule.length > 0 && <Schedule event={event} multiDay={multiDay} />}

      {event.files.length > 0 && (
        <section aria-labelledby="dateien" className="flex flex-col gap-2">
          <h2 id="dateien" className="text-lg font-semibold">
            Dateien
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {event.files.map((f) => (
              <li key={f.id}>
                <a href={`/api/events/${event.id}/files/${f.id}`} className="underline">
                  {f.description}
                </a>{" "}
                <span className="text-neutral-500">{formatFileSize(f.size)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {event.additionalInfo && (
        <section aria-labelledby="hinweise" className="flex flex-col gap-1">
          <h2 id="hinweise" className="text-lg font-semibold">
            Weitere Hinweise
          </h2>
          <p className="whitespace-pre-line text-sm">{event.additionalInfo}</p>
        </section>
      )}
    </article>
  );
}

function Schedule({ event, multiDay }: { event: PublicEventDetail; multiDay: boolean }) {
  return (
    <section aria-labelledby="ablauf" className="flex flex-col gap-2">
      <h2 id="ablauf" className="text-lg font-semibold">
        Ablauf
      </h2>
      <table className="w-full text-left text-sm">
        <tbody>
          {event.schedule.map((s, i) => (
            <tr key={i} className="border-b last:border-0 align-top">
              <td className="whitespace-nowrap py-1 pr-4 text-neutral-700">
                {multiDay && s.date ? `${formatDate(s.date)} ` : ""}
                {s.time ? `${s.time}${s.endTime ? `–${s.endTime}` : ""}` : ""}
              </td>
              <td className="py-1">
                <span className="font-medium">{s.title}</span>
                {s.type !== "custom" && s.title !== SCHEDULE_ENTRY_TYPE_LABELS[s.type] && (
                  <span className="text-neutral-500"> ({SCHEDULE_ENTRY_TYPE_LABELS[s.type]})</span>
                )}
                {s.description && <div className="text-neutral-600">{s.description}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
