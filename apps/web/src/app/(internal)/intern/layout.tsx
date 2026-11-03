import { Suspense } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/current-user";

/**
 * Internal area layout: public header + additional sub-navigation (spec §9.3).
 * The session check here is a convenience; every page/data access must call
 * requireUser() itself and Fastify authorizes every sensitive request.
 */
export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <span className="font-semibold">Bezirksschwimmverband Südwestsachsen</span>
        <Suspense>
          <UserBadge />
        </Suspense>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Interne Navigation"
          className="border-b p-4 md:w-56 md:border-r md:border-b-0"
        >
          {/* Internal sub-navigation (role-dependent, Phase 6) */}
        </nav>
        <main className="flex-1 px-4 py-6">
          <Suspense fallback={<p>Wird geladen …</p>}>{children}</Suspense>
        </main>
      </div>
    </>
  );
}

async function UserBadge() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-3 text-sm">
      <span>
        {user.firstName} {user.lastName}
      </span>
      <form action={logoutAction}>
        <button type="submit" className="underline">
          Abmelden
        </button>
      </form>
    </div>
  );
}
