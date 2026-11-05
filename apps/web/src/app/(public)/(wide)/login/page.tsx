import type { Metadata } from "next";
import { Suspense } from "react";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Anmelden</h1>
      <p className="max-w-prose text-sm">
        Der interne Bereich ist Vereinen und dem Verband vorbehalten. Ein Zugang ist nur über eine
        Einladung möglich.
      </p>
      {/* searchParams is request data → streamed behind Suspense (Cache Components). The form is
          server-rendered, so login also works without JavaScript. */}
      <Suspense>
        <LoginFormWithTarget searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function LoginFormWithTarget({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const registered = first(params.registriert) === "1";
  return (
    <div className="flex flex-col gap-4">
      {registered && (
        <p
          role="status"
          className="max-w-sm rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          Dein Konto ist bestätigt und du bist dem Verein beigetreten. Bitte melde dich jetzt an.
        </p>
      )}
      <LoginForm
        next={safeRedirectPath(first(params.next))}
        defaultEmail={first(params.email)?.slice(0, 254)}
      />
    </div>
  );
}
