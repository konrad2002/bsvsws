import { MEMBERSHIP_ROLE_LABELS } from "@bsv-sws/shared";
import { buttonVariants } from "@bsv-sws/ui/components/button";
import { Alert } from "@bsv-sws/ui/components/form";
import {
  invitationTokenSchema,
  publicInvitationSchema,
  type PublicInvitation,
} from "@bsv-sws/validation";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { apiFetch } from "@/lib/api";
import { AcceptForm } from "./accept-form";
import { RegistrationFlow } from "./registration-flow";

export const metadata: Metadata = { title: "Einladung", robots: { index: false } };

export default function InvitationPage({ params }: PageProps<"/einladung/[token]">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Einladung</h1>
      <Suspense fallback={<p>Einladung wird geprüft …</p>}>
        <InvitationContent params={params} />
      </Suspense>
    </div>
  );
}

const CLOSED_MESSAGES: Record<Exclude<PublicInvitation["status"], "valid">, string> = {
  invalid: "Dieser Einladungslink ist ungültig. Bitte prüfe, ob du ihn vollständig kopiert hast.",
  expired:
    "Diese Einladung ist abgelaufen. Bitte bitte die einladende Person um eine neue Einladung.",
  accepted: "Diese Einladung wurde bereits angenommen.",
  revoked: "Diese Einladung wurde zurückgezogen.",
};

async function InvitationContent({ params }: Pick<PageProps<"/einladung/[token]">, "params">) {
  const { token } = await params;
  if (!invitationTokenSchema.safeParse(token).success) {
    return <Alert variant="error">{CLOSED_MESSAGES.invalid}</Alert>;
  }
  const [invitation, user] = await Promise.all([
    apiFetch(`/invitations/by-token/${token}`).then((d) => publicInvitationSchema.parse(d)),
    getCurrentUser(),
  ]);
  if (invitation.status !== "valid") {
    return (
      <Alert variant={invitation.status === "accepted" ? "info" : "error"}>
        {CLOSED_MESSAGES[invitation.status]}
      </Alert>
    );
  }

  const email = invitation.email!;
  const intro = (
    <p className="max-w-prose">
      Du wurdest als <strong>{MEMBERSHIP_ROLE_LABELS[invitation.role!]}</strong> des Vereins{" "}
      <strong>{invitation.clubName}</strong> in den internen Bereich eingeladen. Die Einladung gilt
      für <strong>{email}</strong>.
    </p>
  );

  if (user) {
    if (user.email.toLowerCase() !== email.toLowerCase()) {
      return (
        <div className="flex flex-col gap-4">
          {intro}
          <Alert variant="error">
            Du bist als {user.email} angemeldet. Diese Einladung gilt für eine andere
            E-Mail-Adresse.
          </Alert>
          <form action={logoutAction}>
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              Abmelden
            </button>
          </form>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {intro}
        <AcceptForm token={token} />
      </div>
    );
  }

  if (invitation.accountExists) {
    return (
      <div className="flex flex-col gap-4">
        {intro}
        <p>
          Für diese E-Mail-Adresse gibt es bereits ein Konto. Bitte melde dich an, um die Einladung
          anzunehmen.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/einladung/${token}`)}&email=${encodeURIComponent(email)}`}
          className={buttonVariants()}
        >
          Anmelden und annehmen
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {intro}
      <RegistrationFlow
        token={token}
        email={email}
        awaitingVerification={invitation.awaitingVerification}
      />
    </div>
  );
}
