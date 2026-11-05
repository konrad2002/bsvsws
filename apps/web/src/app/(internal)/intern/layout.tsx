import { Suspense } from "react";
import { InternalNav } from "@/components/internal/internal-nav";
import { SiteHeader } from "@/components/layout/site-header";
import { logoutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/current-user";

/**
 * Internal area layout: the site header in its dark variant (owner decision) plus
 * the internal sub-navigation (spec §9.3). The session check here is a
 * convenience; every page/data access calls requireUser() itself and Fastify
 * authorizes every sensitive request.
 */
export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        className="theme-dark-header"
        actions={
          <Suspense>
            <UserBadge />
          </Suspense>
        }
      />
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Interne Navigation"
          className="border-b bg-background p-6 md:w-60 md:border-r md:border-b-0"
        >
          <Suspense>
            <InternalNav />
          </Suspense>
        </nav>
        <main className="page-padding flex-1 bg-page text-page-foreground">
          <Suspense fallback={<p>Wird geladen …</p>}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

async function UserBadge() {
  const user = await requireUser();
  return (
    <>
      <span className="hidden sm:inline">
        {user.firstName} {user.lastName}
      </span>
      <form action={logoutAction}>
        <button type="submit" className="underline-offset-4 hover:underline">
          Abmelden
        </button>
      </form>
    </>
  );
}
