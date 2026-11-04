import Link from "next/link";
import { Suspense } from "react";
import { FooterNavigation, MainNavigation } from "@/components/public/site-navigation";
import { getNavigation } from "@/lib/data/public-content";

/**
 * Public website layout with the database-managed navigation (spec §9.1/9.2).
 * Visual design is a functional placeholder (spec §9.5).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <Link href="/" className="font-semibold">
          Bezirksschwimmverband Südwestsachsen
        </Link>
        <Suspense fallback={<span className="text-sm text-neutral-500">Menü wird geladen …</span>}>
          <HeaderNavigation />
        </Suspense>
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 text-sm text-neutral-700">
        <span>© Bezirksschwimmverband Südwestsachsen e. V.</span>
        <Suspense>
          <FooterLinks />
        </Suspense>
      </footer>
    </>
  );
}

async function HeaderNavigation() {
  const nav = await getNavigation();
  return <MainNavigation items={nav.main} />;
}

async function FooterLinks() {
  const nav = await getNavigation();
  return <FooterNavigation items={nav.footer} />;
}
