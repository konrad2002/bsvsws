import type { NavItem } from "@bsv-sws/validation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInternalNavigation } from "@/lib/data/internal-content";
import { getReviewQueue } from "@/lib/data/events";

/**
 * Internal sub-navigation (spec §9.3, owner decision): fixed app links per role
 * plus the CMS menu "Interner Bereich" filtered by the user's level.
 * Visibility is cosmetic – Fastify authorizes every request.
 */
export async function InternalNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const federation = user.level === "federation" || user.level === "administrator";
  const isRep = user.membership?.role === "representative";
  const [reviewCount, cms] = await Promise.all([
    federation
      ? getReviewQueue()
          .then((q) => q.pendingEvents.length + q.pendingRemovals.length)
          .catch(() => 0)
      : Promise.resolve(0),
    getInternalNavigation()
      .then((n) => n.internal)
      .catch(() => [] as NavItem[]),
  ]);
  const appLinks = [
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
          { href: "/intern/verband/benutzer", label: "Benutzerkonten" },
          { href: "/intern/verband/protokoll", label: "Protokoll" },
          { href: "/intern/verband/einstellungen", label: "Einstellungen" },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-row flex-wrap gap-x-4 gap-y-2 md:flex-col">
        {appLinks.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm link">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
      {cms.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Interner Bereich
          </p>
          <CmsLinks items={cms} />
        </div>
      )}
    </div>
  );
}

function CmsLinks({ items, nested = false }: { items: NavItem[]; nested?: boolean }) {
  return (
    <ul
      className={
        nested ? "ml-3 flex flex-col gap-1" : "flex flex-row flex-wrap gap-x-4 gap-y-2 md:flex-col"
      }
    >
      {items.map((item) => (
        <li key={item.id}>
          {item.href ? (
            item.external ? (
              <a
                href={item.href}
                className="text-sm link"
                {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {item.label}
              </a>
            ) : (
              <Link href={item.href} className="text-sm link">
                {item.label}
              </Link>
            )
          ) : (
            <span className="text-sm font-medium">{item.label}</span>
          )}
          {item.children.length > 0 && <CmsLinks items={item.children} nested />}
        </li>
      ))}
    </ul>
  );
}
