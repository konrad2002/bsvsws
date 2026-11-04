import { EVENT_CALENDAR_LABELS } from "@bsv-sws/shared";
import { Badge } from "@bsv-sws/ui/components/form";
import type { EventSummary } from "@bsv-sws/validation";
import Link from "next/link";
import { formatDateRange } from "@/lib/format";
import { EventStatusBadge } from "./event-status";

export function EventTable({ events, showClub }: { events: EventSummary[]; showClub: boolean }) {
  if (events.length === 0)
    return <p className="text-sm text-neutral-600">Keine Veranstaltungen.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b">
          <tr>
            <th className="py-2 pr-4 font-medium">Datum</th>
            <th className="py-2 pr-4 font-medium">Titel</th>
            {showClub && <th className="py-2 pr-4 font-medium">Verein</th>}
            <th className="py-2 pr-4 font-medium">Kalender</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b last:border-0">
              <td className="whitespace-nowrap py-2 pr-4">
                {formatDateRange(e.startDate, e.endDate)}
              </td>
              <td className="py-2 pr-4">
                <Link href={`/intern/veranstaltungen/${e.id}`} className="hover:underline">
                  {e.title}
                </Link>
              </td>
              {showClub && <td className="py-2 pr-4">{e.club?.name ?? "Verband"}</td>}
              <td className="py-2 pr-4">{EVENT_CALENDAR_LABELS[e.calendar]}</td>
              <td className="py-2">
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
