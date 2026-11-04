import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getReviewQueue } from "@/lib/data/events";

/** Role-dependent internal sub-navigation (spec §9.3). Visibility is cosmetic; Fastify authorizes. */
export async function InternalNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const federation = user.level === "federation" || user.level === "administrator";
  const isRep = user.membership?.role === "representative";
  // Actionable indicator instead of a notification center (spec §10.4).
  const reviewCount = federation
    ? await getReviewQueue()
        .then((q) => q.pendingEvents.length + q.pendingRemovals.length)
        .catch(() => 0)
    : 0;
  const links = [
    { href: "/intern", label: "Übersicht" },
    ...(user.membership ? [{ href: "/intern/verein", label: "Mein Verein" }] : []),
    ...(isRep ? [{ href: "/intern/verein/mitglieder", label: "Mitglieder" }] : []),
    ...(isRep || federation ? [{ href: "/intern/veranstaltungen", label: "Veranstaltungen" }] : []),
    ...(federation
      ? [
          {
            href: "/intern/verband/pruefung",
            label: reviewCount ? `Prüfung (${reviewCount})` : "Prüfung",
          },
          { href: "/intern/verband/vereine", label: "Vereine verwalten" },
        ]
      : []),
  ];
  return (
    <ul className="flex flex-row flex-wrap gap-x-4 gap-y-2 md:flex-col">
      {links.map((l) => (
        <li key={l.href}>
          <Link href={l.href} className="text-sm hover:underline">
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
