import { EVENT_CALENDAR_LABELS, REMOVAL_TYPE_LABELS } from "@bsv-sws/shared";
import { Alert } from "@bsv-sws/ui/components/form";
import { uuidSchema, type EventDetail } from "@bsv-sws/validation";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventActionsPanel } from "@/components/internal/events/event-actions-panel";
import { EventFiles, EventImages } from "@/components/internal/events/event-files";
import { EventForm } from "@/components/internal/events/event-form";
import { EventHistory } from "@/components/internal/events/event-history";
import { EventStatusBadge } from "@/components/internal/events/event-status";
import { Section } from "@/components/internal/notices";
import { ApiRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/current-user";
import { listClubs } from "@/lib/data/clubs";
import { getEvent, getEventHistory, listEventCategories } from "@/lib/data/events";
import { formatDateRange, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Veranstaltung" };

function ReadOnly({ event }: { event: EventDetail }) {
  return (
    <dl className="grid max-w-2xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="font-medium">Datum</dt>
      <dd>
        {formatDateRange(event.startDate, event.endDate)}
        {!event.allDay && event.startTime
          ? `, ${event.startTime}${event.endTime ? `–${event.endTime}` : ""} Uhr`
          : ""}
      </dd>
      <dt className="font-medium">Kalender</dt>
      <dd>{EVENT_CALENDAR_LABELS[event.calendar]}</dd>
      {event.venue && (
        <>
          <dt className="font-medium">Ort</dt>
          <dd>{[event.venue, event.city].filter(Boolean).join(", ")}</dd>
        </>
      )}
      {event.description && (
        <>
          <dt className="font-medium">Beschreibung</dt>
          <dd className="whitespace-pre-line">{event.description}</dd>
        </>
      )}
    </dl>
  );
}

export default async function EventPage({
  params,
}: PageProps<"/intern/veranstaltungen/[eventId]">) {
  const { eventId } = await params;
  const user = await requireUser(`/intern/veranstaltungen/${eventId}`);
  if (!uuidSchema.safeParse(eventId).success) notFound();
  const federation = user.level === "federation" || user.level === "administrator";

  let event: EventDetail;
  try {
    event = await getEvent(eventId);
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 404 || error.status === 403))
      notFound();
    throw error;
  }
  const editable = event.allowedActions.includes("edit");
  const involved =
    federation ||
    (event.club &&
      user.membership?.role === "representative" &&
      user.membership.club.id === event.club.id);
  const [categories, clubs, history] = await Promise.all([
    editable ? listEventCategories() : Promise.resolve([]),
    editable && federation ? listClubs() : Promise.resolve([]),
    involved ? getEventHistory(eventId) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/intern/veranstaltungen" className="text-sm link">
          ← Alle Veranstaltungen
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1>{event.title}</h1>
          <EventStatusBadge status={event.status} deleted={event.deleted} />
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDateRange(event.startDate, event.endDate)} · {event.club?.name ?? "Verband"}
          {event.submittedAt ? ` · eingereicht ${formatDateTime(event.submittedAt)}` : ""}
        </p>
        {event.status === "published" && event.slug && !event.deleted && (
          <Link href={`/veranstaltungen/${event.slug}`} className="text-sm link">
            Öffentliche Seite ansehen
          </Link>
        )}
      </div>

      {event.status === "rejected" && event.reviewComment && (
        <Alert variant="error">
          <strong>Vom Verband abgelehnt:</strong>
          <p className="whitespace-pre-line">{event.reviewComment}</p>
          <p className="mt-1">Bitte überarbeite die Veranstaltung und reiche sie erneut ein.</p>
        </Alert>
      )}
      {event.status === "pending" && (
        <Alert>
          Die Veranstaltung wartet auf die Prüfung durch den Verband. Änderungen sind weiterhin
          möglich.
        </Alert>
      )}
      {event.pendingRemoval && (
        <Alert>
          Offener Antrag auf <strong>{REMOVAL_TYPE_LABELS[event.pendingRemoval.type]}</strong>
          {event.pendingRemoval.requestedBy ? ` (${event.pendingRemoval.requestedBy})` : ""}:{" "}
          {event.pendingRemoval.reason}. Die Veranstaltung bleibt bis zur Entscheidung öffentlich.
        </Alert>
      )}

      <EventActionsPanel event={event} />

      <Section title="Daten">
        {editable ? (
          <EventForm
            event={event}
            categories={categories}
            federation={federation}
            clubs={clubs.map((c) => ({ id: c.id, name: c.name }))}
            clubName={event.club?.name}
          />
        ) : (
          <ReadOnly event={event} />
        )}
      </Section>
      <Section title="Bilder">
        <EventImages event={event} editable={editable} />
      </Section>
      <Section title="Dateien">
        <EventFiles event={event} editable={editable} />
      </Section>
      {involved && (
        <Section title="Verlauf">
          <EventHistory entries={history} />
        </Section>
      )}
    </div>
  );
}
