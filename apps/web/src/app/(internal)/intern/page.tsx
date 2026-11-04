import { MEMBERSHIP_ROLE_LABELS, USER_LEVEL_LABELS } from "@bsv-sws/shared";
import { Alert, Badge } from "@bsv-sws/ui/components/form";
import type { SessionUser } from "@bsv-sws/validation";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EventList } from "@/components/public/events/event-list-item";
import { Section } from "@/components/internal/notices";
import { requireUser } from "@/lib/auth/current-user";
import { addDays, todayInBerlin } from "@/lib/calendar";
import { listClubs, listInvitations, listMembers } from "@/lib/data/clubs";
import { getReviewQueue, listEvents } from "@/lib/data/events";
import { listPublicEvents } from "@/lib/data/public-events";

export const metadata: Metadata = { title: "Intern" };

/**
 * Role-dependent dashboard (spec §10.4: actionable indicators instead of a
 * notification center). Every number comes from the API, which authorizes it.
 */
export default async function InternalHomePage() {
  const user = await requireUser("/intern");
  const federation = user.level === "federation" || user.level === "administrator";
  const isRep = user.membership?.role === "representative";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Hallo {user.firstName ?? user.email}</h1>
        <p className="text-sm text-neutral-700">
          {USER_LEVEL_LABELS[user.level]}
          {user.membership
            ? ` · ${user.membership.club.name} (${MEMBERSHIP_ROLE_LABELS[user.membership.role]})`
            : ""}
        </p>
      </div>

      {!user.membership && !federation && (
        <Alert>
          Du bist keinem Verein zugeordnet. Über eine Einladung deines Vereins erhältst du Zugriff
          auf den Vereinsbereich.
        </Alert>
      )}

      {federation && (
        <Suspense fallback={<p className="text-sm">Aufgaben werden geladen …</p>}>
          <FederationTasks />
        </Suspense>
      )}
      {isRep && (
        <Suspense fallback={<p className="text-sm">Aufgaben werden geladen …</p>}>
          <RepresentativeTasks user={user} />
        </Suspense>
      )}
      {user.membership && (
        <Suspense fallback={<p className="text-sm">Veranstaltungen werden geladen …</p>}>
          <ClubEvents user={user} />
        </Suspense>
      )}
    </div>
  );
}

function Task({
  href,
  label,
  count,
  hint,
}: {
  href: string;
  label: string;
  count: number;
  hint?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded border px-3 py-2 hover:bg-neutral-50"
      >
        <span className="text-sm">
          {label}
          {hint && <span className="block text-xs text-neutral-600">{hint}</span>}
        </span>
        <Badge className={count > 0 ? "border-neutral-900 font-semibold" : ""}>{count}</Badge>
      </Link>
    </li>
  );
}

async function FederationTasks() {
  const [queue, clubs] = await Promise.all([getReviewQueue(), listClubs()]);
  const activeClubs = clubs.filter((c) => c.active);
  const withoutRep = (
    await Promise.all(
      activeClubs.map(async (c) =>
        (await listMembers(c.id)).some((m) => m.role === "representative") ? null : c,
      ),
    )
  ).filter(Boolean);
  return (
    <Section title="Verband">
      <ul className="grid gap-2 sm:grid-cols-2">
        <Task
          href="/intern/verband/pruefung"
          label="Eingereichte Veranstaltungen"
          count={queue.pendingEvents.length}
        />
        <Task
          href="/intern/verband/pruefung"
          label="Entfernungsanträge"
          count={queue.pendingRemovals.length}
        />
        <Task
          href="/intern/verband/vereine"
          label="Vereine ohne Vereinsvertreter"
          count={withoutRep.length}
          hint="Erstelle für diese Vereine eine Vertreter-Einladung."
        />
        <Task href="/intern/verband/vereine" label="Aktive Vereine" count={activeClubs.length} />
      </ul>
    </Section>
  );
}

async function RepresentativeTasks({ user }: { user: SessionUser }) {
  const clubId = user.membership!.club.id;
  const [events, invitations, members] = await Promise.all([
    listEvents(),
    listInvitations(clubId),
    listMembers(clubId),
  ]);
  const count = (status: string) => events.filter((e) => e.status === status).length;
  return (
    <Section title="Mein Verein – Aufgaben">
      <ul className="grid gap-2 sm:grid-cols-2">
        <Task
          href="/intern/veranstaltungen?status=rejected"
          label="Abgelehnte Veranstaltungen"
          count={count("rejected")}
          hint="Überarbeiten und erneut einreichen"
        />
        <Task href="/intern/veranstaltungen?status=draft" label="Entwürfe" count={count("draft")} />
        <Task
          href="/intern/veranstaltungen?status=pending"
          label="Beim Verband in Prüfung"
          count={count("pending")}
        />
        <Task
          href="/intern/verein/mitglieder"
          label="Offene Einladungen"
          count={invitations.filter((i) => i.status === "pending").length}
        />
        <Task href="/intern/verein/mitglieder" label="Mitglieder" count={members.length} />
      </ul>
    </Section>
  );
}

async function ClubEvents({ user }: { user: SessionUser }) {
  await connection();
  const today = todayInBerlin();
  const events = await listPublicEvents({
    from: today,
    to: addDays(today, 365),
    club: user.membership!.club.slug,
  });
  return (
    <Section title="Kommende Veranstaltungen des Vereins">
      <EventList events={events.slice(0, 5)} empty="Keine veröffentlichten Veranstaltungen." />
    </Section>
  );
}
