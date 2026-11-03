import { uuidSchema } from "@bsv-sws/validation";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClubForm } from "@/components/internal/club-form";
import { InvitationsPanel } from "@/components/internal/invitations-panel";
import { LogoUpload } from "@/components/internal/logo-upload";
import { MembersTable } from "@/components/internal/members-table";
import { NoAccess, Section } from "@/components/internal/notices";
import { ApiRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/current-user";
import { getClub, listInvitations, listMembers } from "@/lib/data/clubs";

export const metadata: Metadata = { title: "Verein bearbeiten" };

export default async function FederationClubPage({
  params,
}: PageProps<"/intern/verband/vereine/[clubId]">) {
  const { clubId } = await params;
  const user = await requireUser(`/intern/verband/vereine/${clubId}`);
  if (user.level !== "federation" && user.level !== "administrator") return <NoAccess />;
  if (!uuidSchema.safeParse(clubId).success) notFound();

  let club;
  try {
    club = await getClub(clubId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
  const [members, invitations] = await Promise.all([listMembers(clubId), listInvitations(clubId)]);
  const hasRepresentative = members.some((m) => m.role === "representative");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href="/intern/verband/vereine" className="text-sm hover:underline">
          ← Alle Vereine
        </Link>
        <h1 className="text-2xl font-semibold">{club.name}</h1>
      </div>
      <Section title="Mitglieder">
        {!hasRepresentative && (
          <p className="text-sm">
            Dieser Verein hat noch keinen Vereinsvertreter. Lade eine Person mit der Rolle
            „Vereinsvertreter“ ein.
          </p>
        )}
        <MembersTable members={members} currentUserId={user.id} isFederation />
      </Section>
      <Section title="Einladungen">
        <InvitationsPanel clubId={clubId} invitations={invitations} allowRepresentativeInvites />
      </Section>
      <Section title="Logo">
        <LogoUpload clubId={club.id} logoId={club.logo} clubName={club.name} />
      </Section>
      <Section title="Vereinsdaten">
        <ClubForm mode="federation" club={club} />
      </Section>
    </div>
  );
}
