import { EVENT_CALENDAR_LABELS } from "@bsv-sws/shared";
import type { Metadata } from "next";
import { ClubForm } from "@/components/internal/club-form";
import { LogoUpload } from "@/components/internal/logo-upload";
import { NoAccess, Section } from "@/components/internal/notices";
import { requireUser } from "@/lib/auth/current-user";
import { getClub } from "@/lib/data/clubs";

export const metadata: Metadata = { title: "Mein Verein" };

export default async function MyClubPage() {
  const user = await requireUser("/intern/verein");
  if (!user.membership) return <NoAccess>Du bist keinem Verein zugeordnet.</NoAccess>;
  const club = await getClub(user.membership.club.id);
  const isRep = user.membership.role === "representative";

  return (
    <div className="flex flex-col gap-8">
      <h1>{club.name}</h1>
      {isRep ? (
        <>
          <Section title="Logo">
            <LogoUpload clubId={club.id} logoId={club.logo} clubName={club.name} />
          </Section>
          <Section title="Vereinsdaten">
            <ClubForm mode="representative" club={club} />
          </Section>
        </>
      ) : (
        <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {club.website && (
            <>
              <dt className="font-medium">Website</dt>
              <dd>{club.website}</dd>
            </>
          )}
          {club.email && (
            <>
              <dt className="font-medium">E-Mail</dt>
              <dd>{club.email}</dd>
            </>
          )}
          {club.city && (
            <>
              <dt className="font-medium">Ort</dt>
              <dd>{[club.postalCode, club.city].filter(Boolean).join(" ")}</dd>
            </>
          )}
          {club.sports.length > 0 && (
            <>
              <dt className="font-medium">Sportarten</dt>
              <dd>{club.sports.map((s) => EVENT_CALENDAR_LABELS[s]).join(", ")}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
