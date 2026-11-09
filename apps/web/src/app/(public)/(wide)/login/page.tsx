import { Alert } from "@bsv-sws/ui/components/form";
import type { Metadata } from "next";
import { Suspense } from "react";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="flex flex-col gap-6">
      <h1>Anmelden</h1>
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
        <Alert variant="success" className="max-w-sm">
          Dein Konto ist bestätigt und du bist dem Verein beigetreten. Bitte melde dich jetzt an.
        </Alert>
      )}
      <LoginForm
        next={safeRedirectPath(first(params.next))}
        defaultEmail={first(params.email)?.slice(0, 254)}
      />
    </div>
  );
}
