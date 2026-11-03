/**
 * Internal area layout: public header + additional sub-navigation (spec §9.3).
 * Authentication/authorization is enforced server-side (Phase 1) – never rely on hiding UI.
 */
export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b px-4 py-3">
        <span className="font-semibold">Bezirksschwimmverband Südwestsachsen</span>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Interne Navigation"
          className="border-b p-4 md:w-56 md:border-r md:border-b-0"
        >
          {/* Internal sub-navigation */}
        </nav>
        <main className="flex-1 px-4 py-6">{children}</main>
      </div>
    </>
  );
}
