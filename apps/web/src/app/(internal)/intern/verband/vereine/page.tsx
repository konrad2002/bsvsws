import { Badge } from "@bsv-sws/ui/components/form";
import type { Metadata } from "next";
import Link from "next/link";
import { ClubForm } from "@/components/internal/club-form";
import { NoAccess, Section } from "@/components/internal/notices";
import { requireUser } from "@/lib/auth/current-user";
import { listClubs } from "@/lib/data/clubs";

export const metadata: Metadata = { title: "Vereine verwalten" };

export default async function FederationClubsPage() {
  const user = await requireUser("/intern/verband/vereine");
  if (user.level !== "federation" && user.level !== "administrator") return <NoAccess />;
  const clubs = await listClubs();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Vereine verwalten</h1>
      <Section title={`Vereine (${clubs.length})`}>
        <ul className="flex flex-col divide-y rounded border">
          {clubs.map((club) => (
            <li key={club.id} className="flex items-center justify-between gap-4 px-3 py-2">
              <Link href={`/intern/verband/vereine/${club.id}`} className="hover:underline">
                {club.name}
              </Link>
              {!club.active && <Badge>inaktiv</Badge>}
            </li>
          ))}
          {clubs.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-600">Noch keine Vereine.</li>
          )}
        </ul>
      </Section>
      <Section title="Neuen Verein anlegen">
        <ClubForm mode="create" />
      </Section>
    </div>
  );
}
