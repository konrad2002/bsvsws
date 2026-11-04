import { EVENT_STATUS_LABELS, type EventStatus } from "@bsv-sws/shared";
import { Badge } from "@bsv-sws/ui/components/form";

export function EventStatusBadge({ status, deleted }: { status: EventStatus; deleted?: boolean }) {
  if (deleted) return <Badge className="border-red-300 text-red-800">Gelöscht</Badge>;
  return <Badge>{EVENT_STATUS_LABELS[status]}</Badge>;
}
