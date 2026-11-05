import { EVENT_STATUS_LABELS, EVENT_STATUSES, type EventStatus } from "@bsv-sws/shared";
import { buttonVariants } from "@bsv-sws/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { EventTable } from "@/components/internal/events/event-table";
import { NoAccess } from "@/components/internal/notices";
import { requireUser } from "@/lib/auth/current-user";
import { listEvents } from "@/lib/data/events";

export const metadata: Metadata = { title: "Veranstaltungen" };

export default async function EventsPage({ searchParams }: PageProps<"/intern/veranstaltungen">) {
  const user = await requireUser("/intern/veranstaltungen");
  const federation = user.level === "federation" || user.level === "administrator";
  if (!federation && user.membership?.role !== "representative") {
    return <NoAccess>Veranstaltungen verwalten Vereinsvertreter und der Verband.</NoAccess>;
  }
  const params = await searchParams;
  const status = EVENT_STATUSES.find((s) => s === params.status) as EventStatus | undefined;
  const archive = federation && params.archiv === "1";
  const events = await listEvents({ status, deleted: archive });

  const filterLink = (label: string, query: string, active: boolean) => (
    <Link
      key={label}
      href={`/intern/veranstaltungen${query}`}
      aria-current={active ? "page" : undefined}
      className="link"
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Veranstaltungen{federation ? "" : ` – ${user.membership!.club.name}`}</h1>
        <Link href="/intern/veranstaltungen/neu" className={buttonVariants()}>
          Neue Veranstaltung
        </Link>
      </div>
      <nav aria-label="Filter" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {filterLink("Alle", "", !status && !archive)}
        {EVENT_STATUSES.map((s) =>
          filterLink(EVENT_STATUS_LABELS[s], `?status=${s}`, status === s && !archive),
        )}
        {federation && filterLink("Archiv (gelöscht)", "?archiv=1", archive)}
      </nav>
      <EventTable events={events} showClub={federation} />
    </div>
  );
}
