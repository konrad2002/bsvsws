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

async function LoginFormWithTarget({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={safeRedirectPath(Array.isArray(next) ? next[0] : next)} />;
}
