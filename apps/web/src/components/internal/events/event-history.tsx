import type { EventHistoryEntry } from "@bsv-sws/validation";
import { formatDateTime } from "@/lib/format";

const ACTION_LABELS: Record<string, string> = {
  "event.created": "Angelegt",
  "event.updated": "Bearbeitet",
  "event.submitted": "Zur Freigabe eingereicht",
  "event.resubmitted": "Erneut eingereicht",
  "event.approved": "Freigegeben",
  "event.rejected": "Abgelehnt",
  "event.published": "Direkt veröffentlicht",
  "event.unpublished": "Depubliziert",
  "event.removal_requested": "Entfernung beantragt",
  "event.removal_approved": "Entfernungsantrag genehmigt",
  "event.removal_rejected": "Entfernungsantrag abgelehnt",
  "event.deleted": "Gelöscht",
  "event.discarded": "Verworfen",
  "event.file_added": "Datei hinzugefügt",
  "event.file_removed": "Datei entfernt",
  "event.image_changed": "Bild geändert",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Titel",
  startDate: "Beginn",
  endDate: "Ende",
  startTime: "Startzeit",
  endTime: "Endzeit",
  allDay: "Ganztägig",
  venue: "Ort",
  calendar: "Kalender",
  description: "Beschreibung",
  schedule: "Ablauf",
  categories: "Kategorien",
};

/** Review history (spec §7.8/§19.4), read from the audit log. */
export function EventHistory({ entries }: { entries: EventHistoryEntry[] }) {
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>;
  return (
    <ol className="flex flex-col gap-3 border-l pl-4">
      {entries.map((e) => (
        <li key={e.id} className="text-sm">
          <div>
            <strong>{ACTION_LABELS[e.action] ?? e.action}</strong>
            <span className="text-muted-foreground">
              {" "}
              · {formatDateTime(e.at)}
              {e.actorName ? ` · ${e.actorName}` : ""}
            </span>
          </div>
          {e.changedFields.length > 0 && (
            <div className="text-muted-foreground">
              Geändert: {e.changedFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
            </div>
          )}
          {e.comment && (
            <p className="mt-1 whitespace-pre-line rounded bg-muted px-2 py-1">{e.comment}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
