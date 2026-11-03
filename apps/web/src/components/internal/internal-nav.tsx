import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";

/** Role-dependent internal sub-navigation (spec §9.3). Visibility is cosmetic; Fastify authorizes. */
export async function InternalNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const federation = user.level === "federation" || user.level === "administrator";
  const links = [
    { href: "/intern", label: "Übersicht" },
    ...(user.membership ? [{ href: "/intern/verein", label: "Mein Verein" }] : []),
    ...(user.membership?.role === "representative"
      ? [{ href: "/intern/verein/mitglieder", label: "Mitglieder" }]
      : []),
    ...(federation ? [{ href: "/intern/verband/vereine", label: "Vereine verwalten" }] : []),
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
