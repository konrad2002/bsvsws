import type { Metadata } from "next";
import { EventForm } from "@/components/internal/events/event-form";
import { NoAccess } from "@/components/internal/notices";
import { requireUser } from "@/lib/auth/current-user";
import { listClubs } from "@/lib/data/clubs";
import { listEventCategories } from "@/lib/data/events";

export const metadata: Metadata = { title: "Neue Veranstaltung" };

export default async function NewEventPage() {
  const user = await requireUser("/intern/veranstaltungen/neu");
  const federation = user.level === "federation" || user.level === "administrator";
  if (!federation && user.membership?.role !== "representative") return <NoAccess />;
  const [categories, clubs] = await Promise.all([
    listEventCategories(),
    federation ? listClubs() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1>Neue Veranstaltung</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        {federation
          ? "Veranstaltungen des Verbands oder im Auftrag eines Vereins. Nach dem Anlegen kannst du sie direkt veröffentlichen."
          : "Die Veranstaltung wird als Entwurf angelegt. Nach dem Einreichen prüft der Verband sie vor der Veröffentlichung."}
      </p>
      <EventForm
        categories={categories}
        federation={federation}
        clubs={clubs.map((c) => ({ id: c.id, name: c.name }))}
        clubName={user.membership?.club.name}
      />
    </div>
  );
}
