import { EVENT_CALENDAR_LABELS } from "@bsv-sws/shared";
import { Badge } from "@bsv-sws/ui/components/form";
import type { EventSummary } from "@bsv-sws/validation";
import Link from "next/link";
import { formatDateRange } from "@/lib/format";
import { EventStatusBadge } from "./event-status";

export function EventTable({ events, showClub }: { events: EventSummary[]; showClub: boolean }) {
  if (events.length === 0)
    return <p className="text-sm text-muted-foreground">Keine Veranstaltungen.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[40rem] text-sm">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Titel</th>
            {showClub && <th>Verein</th>}
            <th>Kalender</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap">{formatDateRange(e.startDate, e.endDate)}</td>
              <td>
                <Link href={`/intern/veranstaltungen/${e.id}`} className="link">
                  {e.title}
                </Link>
              </td>
              {showClub && <td>{e.club?.name ?? "Verband"}</td>}
              <td>{EVENT_CALENDAR_LABELS[e.calendar]}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  <EventStatusBadge status={e.status} deleted={e.deleted} />
                  {e.hasPendingRemoval && <Badge>Entfernung beantragt</Badge>}
                  {e.official && <Badge>offiziell</Badge>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
