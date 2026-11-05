import { cn } from "@bsv-sws/ui/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { MainNavigation } from "@/components/layout/site-navigation";
import { getNavigation } from "@/lib/data/public-content";

/**
 * Site header of bsv-sws.de: logo + database-managed main menu (spec §9.1).
 * Colours come from the --header-* tokens; the internal area renders the same
 * header inside `.theme-dark-header` (dark variant, owner decision).
 */
export function SiteHeader({
  actions,
  className,
}: {
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-linear-to-l from-header to-header-2 text-header-foreground",
        className,
      )}
    >
      <div className="flex min-h-[100px] items-center gap-6 px-6 py-3">
        <Link
          href="/"
          className="shrink-0"
          aria-label="Startseite – Bezirksschwimmverband Südwestsachsen"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG */}
          <img src="/logo-bsv.svg" alt="" width={140} height={52} className="block w-[140px]" />
          <span className="mt-1 block text-[10px] tracking-wide uppercase">Südwestsachsen</span>
        </Link>
        <Suspense>
          <HeaderNavigation />
        </Suspense>
        {actions && <div className="ml-auto flex items-center gap-3 text-sm">{actions}</div>}
      </div>
    </header>
  );
}

async function HeaderNavigation() {
  const nav = await getNavigation();
  return <MainNavigation items={nav.main} />;
}
