import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * Public website layout (bsv-sws.de identity): white header, grey content area,
 * navy footer. Sub-layouts: (sidebar) = content + news sidebar, (wide) = full width.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-public flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1 bg-page text-page-foreground">{children}</main>
      <SiteFooter />
    </div>
  );
}
