import Link from "next/link";

/**
 * Public website layout. The header navigation is a functional placeholder until
 * the database-managed navigation (Phase 5, spec §9.1/9.2) and the visual design.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <Link href="/" className="font-semibold">
          Bezirksschwimmverband Südwestsachsen
        </Link>
        <nav aria-label="Hauptnavigation">
          <ul className="flex gap-4 text-sm">
            <li>
              <Link href="/" className="hover:underline">
                Startseite
              </Link>
            </li>
            <li>
              <Link href="/veranstaltungen" className="hover:underline">
                Veranstaltungen
              </Link>
            </li>
            <li>
              <Link href="/intern" className="hover:underline">
                Intern
              </Link>
            </li>
          </ul>
        </nav>
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
    </>
  );
}
