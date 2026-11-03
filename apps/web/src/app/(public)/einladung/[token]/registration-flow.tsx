"use client";

import { Button } from "@bsv-sws/ui/components/button";
import { Alert, Field, Input } from "@bsv-sws/ui/components/form";
import { useActionState, useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import { registerAction, resendCodeAction, verifyAction } from "./actions";

/** New account: step 1 registration form, step 2 six-digit code from the email. */
export function RegistrationFlow({
  token,
  email,
  awaitingVerification,
}: {
  token: string;
  email: string;
  awaitingVerification: boolean;
}) {
  const [registered, setRegistered] = useState(awaitingVerification);
  return registered ? (
    <VerifyStep token={token} email={email} onRestart={() => setRegistered(false)} />
  ) : (
    <RegisterStep token={token} email={email} onDone={() => setRegistered(true)} />
  );
}

function RegisterStep({
  token,
  email,
  onDone,
}: {
  token: string;
  email: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await registerAction(token, prev, form);
    if (result.ok) onDone();
    return result;
  }, {});
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <h2 className="text-lg font-semibold">Konto anlegen</h2>
      <Field label="E-Mail-Adresse" htmlFor="email" hint="Festgelegt durch die Einladung.">
        <Input id="email" value={email} readOnly disabled />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vorname" htmlFor="firstName" error={err.firstName}>
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label="Nachname" htmlFor="lastName" error={err.lastName}>
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
        </Field>
      </div>
      <Field label="Telefon (optional)" htmlFor="phone" error={err.phone}>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </Field>
      <Field label="Passwort" htmlFor="password" error={err.password} hint="Mindestens 10 Zeichen.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </Field>
      <Field label="Passwort wiederholen" htmlFor="passwordRepeat" error={err.passwordRepeat}>
        <Input
          id="passwordRepeat"
          name="passwordRepeat"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Wird gesendet …" : "Registrieren"}
      </Button>
    </form>
  );
}

function VerifyStep({
  token,
  email,
  onRestart,
}: {
  token: string;
  email: string;
  onRestart: () => void;
}) {
  const [state, action, pending] = useActionState(verifyAction.bind(null, token), {});
  const [resend, setResend] = useState<ActionState>({});
  const [resending, startResend] = useTransition();

  return (
    <div className="flex max-w-md flex-col gap-4">
      <h2 className="text-lg font-semibold">E-Mail-Adresse bestätigen</h2>
      <p className="text-sm">
        Wir haben einen 6-stelligen Code an <strong>{email}</strong> gesendet. Der Code ist 15
        Minuten gültig.
      </p>
      <form action={action} className="flex flex-col gap-4">
        <Field label="Bestätigungscode" htmlFor="code" error={state.fieldErrors?.code}>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            className="max-w-40 tracking-widest"
          />
        </Field>
        {state.error && <Alert variant="error">{state.error}</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? "Wird geprüft …" : "Bestätigen"}
        </Button>
      </form>
      <div className="flex flex-wrap gap-4 text-sm">
        <Button
          variant="link"
          disabled={resending}
          onClick={() => startResend(async () => setResend(await resendCodeAction(token)))}
        >
          Neuen Code senden
        </Button>
        <Button variant="link" onClick={onRestart}>
          Angaben ändern
        </Button>
      </div>
      {resend.message && <Alert variant="success">{resend.message}</Alert>}
      {resend.error && <Alert variant="error">{resend.error}</Alert>}
    </div>
  );
}
