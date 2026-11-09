import { NewsSidebar } from "@/components/layout/news-sidebar";

/** CMS pages and news: grey content column + white "Neuigkeiten" sidebar (hidden on phones). */
export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="page-padding min-w-0">{children}</div>
      <NewsSidebar />
    </div>
  );
}
