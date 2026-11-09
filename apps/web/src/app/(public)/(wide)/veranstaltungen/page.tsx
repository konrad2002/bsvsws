import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarFilterForm } from "@/components/public/events/calendar-filters";
import {
  calendarFromSlug,
  calendarHref,
  parseCalendarParams,
  type CalendarParams,
  type CalendarView,
} from "@/components/public/events/calendar-params";
import { EventList } from "@/components/public/events/event-list-item";
import { MonthView } from "@/components/public/events/month-view";
import { SubscribeBox } from "@/components/public/events/subscribe-box";
import { YearView } from "@/components/public/events/year-view";
import {
  addDays,
  MONTH_NAMES,
  monthKey,
  monthRange,
  parseMonth,
  parseYear,
  shiftMonth,
  todayInBerlin,
} from "@/lib/calendar";
import { getCalendarFilters, listPublicEvents, siteOrigin } from "@/lib/data/public-events";

export const metadata: Metadata = {
  title: "Veranstaltungen",
  description: "Wettkämpfe und Veranstaltungen des Bezirksschwimmverbands Südwestsachsen.",
};

export default function EventsPage({ searchParams }: PageProps<"/veranstaltungen">) {
  return (
    <div className="flex flex-col gap-6">
      <h1>Veranstaltungen</h1>
      <Suspense fallback={<p>Veranstaltungen werden geladen …</p>}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "liste", label: "Liste" },
  { key: "monat", label: "Monat" },
  { key: "jahr", label: "Jahr" },
];

async function Calendar({ searchParams }: Pick<PageProps<"/veranstaltungen">, "searchParams">) {
  const params = parseCalendarParams(await searchParams);
  await connection(); // "today" must be computed per request, not at build time
  const today = todayInBerlin();
  const filter = {
    calendar: calendarFromSlug(params.kalender),
    club: params.verein,
    category: params.kategorie,
  };
  const [options, origin] = await Promise.all([getCalendarFilters(), siteOrigin()]);

  let content: React.ReactNode;
  let navigation: React.ReactNode = null;

  if (params.ansicht === "monat") {
    const { year, month } = parseMonth(params.monat, today);
    const range = monthRange(year, month);
    const events = await listPublicEvents({
      ...filter,
      from: addDays(range.from, -6),
      to: addDays(range.to, 6),
    });
    const prev = shiftMonth(year, month, -1);
    const next = shiftMonth(year, month, 1);
    navigation = (
      <Pager
        title={`${MONTH_NAMES[month - 1]} ${year}`}
        prev={calendarHref(params, { monat: monthKey(prev.year, prev.month) })}
        next={calendarHref(params, { monat: monthKey(next.year, next.month) })}
        current={calendarHref(params, { monat: undefined })}
      />
    );
    content = <MonthView year={year} month={month} events={events} today={today} range={range} />;
  } else if (params.ansicht === "jahr") {
    const year = parseYear(params.jahr, Number(today.slice(0, 4)));
    const events = await listPublicEvents({
      ...filter,
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    });
    navigation = (
      <Pager
        title={String(year)}
        prev={calendarHref(params, { jahr: String(year - 1) })}
        next={calendarHref(params, { jahr: String(year + 1) })}
        current={calendarHref(params, { jahr: undefined })}
      />
    );
    content = <YearView year={year} events={events} params={params} />;
  } else if (params.zeitraum === "vergangen") {
    const events = await listPublicEvents({
      ...filter,
      from: addDays(today, -365),
      to: addDays(today, -1),
    });
    content = (
      <>
        <Link href={calendarHref(params, { zeitraum: undefined })} className="text-sm link">
          ← Kommende Veranstaltungen
        </Link>
        <h2>Vergangene Veranstaltungen (letzte 12 Monate)</h2>
        <EventList events={[...events].reverse()} empty="Keine vergangenen Veranstaltungen." />
      </>
    );
  } else {
    const events = await listPublicEvents({ ...filter, from: today, to: addDays(today, 365) });
    content = (
      <>
        <EventList events={events} empty="Keine kommenden Veranstaltungen gefunden." />
        <Link href={calendarHref(params, { zeitraum: "vergangen" })} className="text-sm link">
          Vergangene Veranstaltungen
        </Link>
      </>
    );
  }

  return (
    <>
      <nav aria-label="Ansicht" className="flex gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={calendarHref(params, { ansicht: v.key } as Partial<CalendarParams>)}
            aria-current={params.ansicht === v.key ? "page" : undefined}
            className={`rounded border px-3 py-1 text-sm ${params.ansicht === v.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      <CalendarFilterForm params={params} options={options} />
      {navigation}
      <div className="flex flex-col gap-3">{content}</div>
      <SubscribeBox host={origin.host} protocol={origin.protocol} />
    </>
  );
}

function Pager({
  title,
  prev,
  next,
  current,
}: {
  title: string;
  prev: string;
  next: string;
  current: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href={prev}
        className="rounded border px-2 py-1 text-sm hover:bg-muted"
        aria-label="Zurück"
      >
        ←
      </Link>
      <h2 className="min-w-40 text-center">{title}</h2>
      <Link
        href={next}
        className="rounded border px-2 py-1 text-sm hover:bg-muted"
        aria-label="Weiter"
      >
        →
      </Link>
      <Link href={current} className="text-sm link">
        Heute
      </Link>
    </div>
  );
}
