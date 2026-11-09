import { Suspense } from "react";
import { FooterNavigation } from "@/components/layout/site-navigation";
import { getNavigation } from "@/lib/data/public-content";

/** Footer of bsv-sws.de (navy gradient, --footer-* tokens) with the footer menu. */
export function SiteFooter() {
  return (
    <footer className="bg-linear-to-l from-footer to-footer-2 px-6 py-8 text-footer-foreground">
      <Suspense>
        <FooterLinks />
      </Suspense>
      <p className="mt-6 text-center text-sm">
        Copyright © Bezirksschwimmverband Südwestsachsen e.V. Alle Rechte vorbehalten.
      </p>
    </footer>
  );
}

async function FooterLinks() {
  const nav = await getNavigation();
  return <FooterNavigation items={nav.footer} />;
}
