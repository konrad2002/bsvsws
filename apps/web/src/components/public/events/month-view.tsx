import type { PublicEventSummary } from "@bsv-sws/validation";
import Link from "next/link";
import { eventsByDay, monthGrid, WEEKDAYS_SHORT } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { eventTime } from "./event-list-item";
import { FederationBadge } from "./federation-badge";

/** Calendar cell entry; federation events are filled with the highlight colour. */
function entryClass(e: PublicEventSummary) {
  return e.byFederation
    ? "block truncate rounded-sm bg-highlight px-1 text-xs font-semibold text-highlight-foreground hover:bg-primary-hover"
    : "link block truncate rounded-sm bg-accent/15 px-1 text-xs";
}

/**
 * Month view: grid on larger screens, day list on mobile (spec §9.4 – calendars
 * must stay usable on small screens).
 */
export function MonthView({
  year,
  month,
  events,
  today,
  range,
}: {
  year: number;
  month: number;
  events: PublicEventSummary[];
  today: string;
  range: { from: string; to: string };
}) {
  const weeks = monthGrid(year, month);
  const byDay = eventsByDay(events, weeks[0]![0]!.date, weeks.at(-1)!.at(-1)!.date);
  const daysWithEvents = [...eventsByDay(events, range.from, range.to).entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <>
      <table className="hidden w-full table-fixed border-collapse text-sm md:table">
        <thead>
          <tr>
            {WEEKDAYS_SHORT.map((d) => (
              <th key={d} scope="col" className="border-b py-1 text-left font-medium">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]!.date}>
              {week.map((day) => (
                <td
                  key={day.date}
                  className={`h-24 border p-1 align-top ${day.inMonth ? "" : "bg-muted text-muted-foreground"}`}
                >
                  <div className={`text-xs ${day.date === today ? "font-bold underline" : ""}`}>
                    <span className="sr-only">{formatDate(day.date)}</span>
                    <span aria-hidden>{day.day}</span>
                  </div>
                  <ul className="mt-1 flex flex-col gap-1">
                    {(byDay.get(day.date) ?? []).map((e) => (
                      <li key={e.slug}>
                        <Link
                          href={`/veranstaltungen/${e.slug}`}
                          className={entryClass(e)}
                          title={e.byFederation ? `${e.title} (BSV-SWS)` : e.title}
                        >
                          {day.date === e.startDate && eventTime(e) ? `${e.startTime} ` : ""}
                          {e.title}
                          {e.byFederation && <span className="sr-only"> (BSV-SWS)</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2 hidden items-center gap-2 text-xs text-muted-foreground md:flex">
        <span aria-hidden className="inline-block size-3 rounded-sm bg-highlight" />
        Veranstaltung des BSV-SWS
      </p>

      <div className="md:hidden">
        {daysWithEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Veranstaltungen in diesem Monat.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {daysWithEvents.map(([date, list]) => (
              <li key={date} className="py-2">
                <div className="text-sm font-medium">{formatDate(date)}</div>
                <ul className="ml-3 flex flex-col">
                  {list.map((e) => (
                    <li key={e.slug} className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/veranstaltungen/${e.slug}`}
                        className={`text-sm link ${e.byFederation ? "font-semibold" : ""}`}
                      >
                        {eventTime(e) && date === e.startDate ? `${e.startTime} · ` : ""}
                        {e.title}
                      </Link>
                      {e.byFederation && <FederationBadge />}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
