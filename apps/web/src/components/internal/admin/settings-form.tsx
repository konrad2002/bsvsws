"use client";

import { Button } from "@bsv-sws/ui/components/button";
import { Alert, Field, Input, Textarea } from "@bsv-sws/ui/components/form";
import type { AppSettings } from "@bsv-sws/validation";
import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { updateSettingsAction } from "@/lib/admin-actions";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateSettingsAction,
    {},
  );
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">E-Mail-Benachrichtigungen</legend>
        <p className="text-sm text-muted-foreground">
          Eine Adresse pro Zeile. Wer hier eingetragen ist, erhält nur E-Mails – aber{" "}
          <strong>keine zusätzlichen Rechte</strong>. Prüfen kann weiterhin nur, wer ein
          Verbandskonto hat.
        </p>
        <Field
          label="Eingereichte Veranstaltungen und Entfernungsanträge"
          htmlFor="eventReviewRecipients"
          error={err.eventReviewRecipients}
        >
          <Textarea
            id="eventReviewRecipients"
            name="eventReviewRecipients"
            rows={4}
            defaultValue={settings.eventReviewRecipients.join("\n")}
          />
        </Field>
        <Field
          label="Neue Vereinsvertreter (Einladung angenommen)"
          htmlFor="representativeJoinedRecipients"
          error={err.representativeJoinedRecipients}
        >
          <Textarea
            id="representativeJoinedRecipients"
            name="representativeJoinedRecipients"
            rows={4}
            defaultValue={settings.representativeJoinedRecipients.join("\n")}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">Vereine</legend>
        <Field
          label="Höchstzahl Vereinsvertreter pro Verein"
          htmlFor="maxRepresentativesPerClub"
          error={err.maxRepresentativesPerClub}
          hint="Leer lassen für unbegrenzt. Gilt, wenn Vereinsvertreter Mitglieder ernennen – der Verband kann die Grenze überschreiten."
        >
          <Input
            id="maxRepresentativesPerClub"
            name="maxRepresentativesPerClub"
            type="number"
            min={1}
            max={100}
            className="max-w-32"
            defaultValue={settings.maxRepresentativesPerClub ?? ""}
          />
        </Field>
      </fieldset>

      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.ok && <Alert variant="success">{state.message}</Alert>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Wird gespeichert …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
