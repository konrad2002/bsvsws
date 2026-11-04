import { EVENT_CALENDAR_LABELS } from "@bsv-sws/shared";
import type { PublicEventSummary } from "@bsv-sws/validation";
import Link from "next/link";
import { formatDateRange } from "@/lib/format";

export function eventTime(e: Pick<PublicEventSummary, "allDay" | "startTime" | "endTime">) {
  if (e.allDay || !e.startTime) return null;
  return `${e.startTime}${e.endTime ? `–${e.endTime}` : ""} Uhr`;
}

export function EventListItem({ event }: { event: PublicEventSummary }) {
  const time = eventTime(event);
  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
      <div className="shrink-0 text-sm font-medium sm:w-48">
        {formatDateRange(event.startDate, event.endDate)}
        {time && <div className="font-normal text-neutral-600">{time}</div>}
      </div>
      <div className="flex flex-col gap-0.5">
        <Link href={`/veranstaltungen/${event.slug}`} className="font-semibold hover:underline">
          {event.title}
        </Link>
        <span className="text-sm text-neutral-700">
          {[event.venue, event.city].filter(Boolean).join(", ")}
          {event.venue || event.city ? " · " : ""}
          {event.organizer}
        </span>
        <span className="text-xs text-neutral-600">
          {[EVENT_CALENDAR_LABELS[event.calendar], ...event.categories.map((c) => c.name)].join(
            " · ",
          )}
        </span>
      </div>
    </li>
  );
}

export function EventList({ events, empty }: { events: PublicEventSummary[]; empty: string }) {
  if (events.length === 0) return <p className="text-sm text-neutral-600">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y">
      {events.map((e) => (
        <EventListItem key={e.slug} event={e} />
      ))}
    </ul>
  );
}
