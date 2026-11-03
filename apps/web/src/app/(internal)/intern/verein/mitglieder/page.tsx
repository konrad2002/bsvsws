import type { Metadata } from "next";
import { InvitationsPanel } from "@/components/internal/invitations-panel";
import { MembersTable } from "@/components/internal/members-table";
import { NoAccess, Section } from "@/components/internal/notices";
import { requireUser } from "@/lib/auth/current-user";
import { listInvitations, listMembers } from "@/lib/data/clubs";

export const metadata: Metadata = { title: "Mitglieder" };

export default async function ClubMembersPage() {
  const user = await requireUser("/intern/verein/mitglieder");
  if (user.membership?.role !== "representative") {
    return <NoAccess>Die Mitgliederverwaltung ist Vereinsvertretern vorbehalten.</NoAccess>;
  }
  const clubId = user.membership.club.id;
  const [members, invitations] = await Promise.all([listMembers(clubId), listInvitations(clubId)]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Mitglieder – {user.membership.club.name}</h1>
      <Section title="Mitglieder">
        <MembersTable members={members} currentUserId={user.id} isFederation={false} />
      </Section>
      <Section title="Einladungen">
        <InvitationsPanel
          clubId={clubId}
          invitations={invitations}
          allowRepresentativeInvites={false}
        />
      </Section>
    </div>
  );
}
