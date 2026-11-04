import type { PublicEventSummary } from "@bsv-sws/validation";
import Link from "next/link";
import { MONTH_NAMES, monthKey } from "@/lib/calendar";
import { formatDateRange } from "@/lib/format";
import { calendarHref, type CalendarParams } from "./calendar-params";

/** Year view: all months with their events (by start month), linking to the month view. */
export function YearView({
  year,
  events,
  params,
}: {
  year: number;
  events: PublicEventSummary[];
  params: CalendarParams;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {MONTH_NAMES.map((name, i) => {
        const key = monthKey(year, i + 1);
        const inMonth = events.filter(
          (e) =>
            e.startDate.slice(0, 7) === key || (e.startDate < key && e.endDate.slice(0, 7) >= key),
        );
        return (
          <section
            key={key}
            aria-labelledby={`m-${key}`}
            className="flex flex-col gap-2 rounded border p-3"
          >
            <h2 id={`m-${key}`} className="font-semibold">
              <Link
                href={calendarHref(params, { ansicht: "monat", monat: key })}
                className="hover:underline"
              >
                {name}
              </Link>
            </h2>
            {inMonth.length === 0 ? (
              <p className="text-xs text-neutral-500">Keine Veranstaltungen</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {inMonth.map((e) => (
                  <li key={e.slug} className="text-sm">
                    <span className="text-neutral-600">
                      {formatDateRange(e.startDate, e.endDate)}
                    </span>{" "}
                    <Link href={`/veranstaltungen/${e.slug}`} className="hover:underline">
                      {e.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
