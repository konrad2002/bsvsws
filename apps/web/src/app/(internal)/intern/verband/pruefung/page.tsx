import { REMOVAL_TYPE_LABELS } from "@bsv-sws/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { EventTable } from "@/components/internal/events/event-table";
import { NoAccess, Section } from "@/components/internal/notices";
import { requireUser } from "@/lib/auth/current-user";
import { getReviewQueue } from "@/lib/data/events";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Prüfung" };

/** Federation review list – actionable indicators instead of a notification center (spec §10.4). */
export default async function ReviewPage() {
  const user = await requireUser("/intern/verband/pruefung");
  if (user.level !== "federation" && user.level !== "administrator") return <NoAccess />;
  const queue = await getReviewQueue();

  return (
    <div className="flex flex-col gap-8">
      <h1>Prüfung</h1>
      <Section title={`Eingereichte Veranstaltungen (${queue.pendingEvents.length})`}>
        <EventTable events={queue.pendingEvents} showClub />
      </Section>
      <Section title={`Entfernungsanträge (${queue.pendingRemovals.length})`}>
        {queue.pendingRemovals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine offenen Anträge.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded border">
            {queue.pendingRemovals.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-3 py-2 text-sm">
                <Link href={`/intern/veranstaltungen/${r.event.id}`} className="font-medium link">
                  {r.event.title}
                </Link>
                <span>
                  {REMOVAL_TYPE_LABELS[r.type]} · {r.requestedBy ?? "–"} ·{" "}
                  {formatDateTime(r.requestedAt)}
                </span>
                {r.reason && <span className="text-muted-foreground">{r.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
