import type { ScheduleEntry } from "@bsv-sws/validation";
import { formatDate } from "@/lib/format";
import { groupSchedule, itemLabel, raceLabel, sectionLabel, timeRange } from "@/lib/schedule";

/**
 * Schedule of an event: sections (Abschnitte) with races and programme items.
 * Manual and SwimResults data render identically.
 */
export function EventSchedule({
  entries,
  multiDay,
  source,
}: {
  entries: ScheduleEntry[];
  multiDay: boolean;
  source: "manual" | "swimresults";
}) {
  return (
    <section aria-labelledby="ablauf" className="flex flex-col gap-3">
      <h2 id="ablauf">Ablauf</h2>
      {source === "swimresults" && (
        <p className="text-xs text-muted-foreground">Aktueller Stand aus SwimResults.</p>
      )}
      {groupSchedule(entries).map((group, i) => {
        const day = group.section?.date ?? null;
        return (
          <div key={i} className="flex flex-col gap-1">
            {group.section && (
              <h3>
                {sectionLabel(group.section)}
                {(day || group.section.time) && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {[
                      day && formatDate(day),
                      group.section.time && `Beginn ${group.section.time} Uhr`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </h3>
            )}
            {group.section?.description && (
              <p className="text-sm text-muted-foreground">{group.section.description}</p>
            )}
            {group.entries.length > 0 && (
              <table className="data-table text-sm">
                <tbody>
                  {group.entries.map((e, j) => (
                    <ScheduleRow
                      key={j}
                      entry={e}
                      showDate={multiDay && !!e.date && e.date !== day}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </section>
  );
}

function ScheduleRow({ entry: e, showDate }: { entry: ScheduleEntry; showDate: boolean }) {
  return (
    <tr>
      <td className="w-32 whitespace-nowrap text-muted-foreground">
        {showDate && `${formatDate(e.date!)} `}
        {timeRange(e)}
      </td>
      {e.kind === "race" ? (
        <td>
          <span className="font-semibold">WK {e.number}</span> {raceLabel(e)}
          {e.description && <div className="text-muted-foreground">{e.description}</div>}
        </td>
      ) : (
        <td>
          <span className="italic">{itemLabel(e)}</span>
          {e.description && <div className="text-muted-foreground">{e.description}</div>}
        </td>
      )}
    </tr>
  );
}
