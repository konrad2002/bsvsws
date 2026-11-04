import {
  ALL_EVENTS_FEED_SLUG,
  CALENDAR_FEED_SLUGS,
  EVENT_CALENDAR_LABELS,
  EVENT_CALENDARS,
} from "@bsv-sws/shared";

/** WebCal subscriptions (spec §7.13): complete calendar + one feed per calendar. */
export function SubscribeBox({ host, protocol }: { host: string; protocol: string }) {
  const feeds = [
    { slug: ALL_EVENTS_FEED_SLUG, label: "Alle Veranstaltungen" },
    ...EVENT_CALENDARS.map((c) => ({
      slug: CALENDAR_FEED_SLUGS[c],
      label: EVENT_CALENDAR_LABELS[c],
    })),
  ];
  return (
    <details className="rounded border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Kalender abonnieren</summary>
      <p className="mt-2 text-neutral-700">
        Abonniere die Veranstaltungen in deiner Kalender-App (z. B. Outlook, Apple- oder
        Google-Kalender). Änderungen werden automatisch übernommen.
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {feeds.map((f) => (
          <li key={f.slug} className="flex flex-wrap items-center gap-x-3">
            <a href={`webcal://${host}/kalender/${f.slug}.ics`} className="font-medium underline">
              {f.label}
            </a>
            <span className="break-all text-xs text-neutral-600">
              {protocol}://{host}/kalender/{f.slug}.ics
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
