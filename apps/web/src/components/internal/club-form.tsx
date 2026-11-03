"use client";

import { EVENT_CALENDAR_LABELS, SPORTS } from "@bsv-sws/shared";
import { Button } from "@bsv-sws/ui/components/button";
import { Alert, Field, Input, Textarea } from "@bsv-sws/ui/components/form";
import type { Club } from "@bsv-sws/validation";
import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { createClubAction, updateClubAction } from "@/lib/club-actions";

type Mode = "create" | "federation" | "representative";

/**
 * Club data form. Representatives see only the fields they may edit (owner
 * decision); Fastify enforces the same rule.
 */
export function ClubForm({ mode, club }: { mode: Mode; club?: Club }) {
  const action =
    mode === "create"
      ? createClubAction
      : updateClubAction.bind(null, club!.id, mode === "federation");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const err = state.fieldErrors ?? {};
  const federation = mode !== "representative";

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {federation ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vereinsname" htmlFor="name" error={err.name} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={club?.name} required />
          </Field>
          <Field
            label="URL-Kürzel (Slug)"
            htmlFor="slug"
            error={err.slug}
            hint="z. B. sv-musterstadt"
          >
            <Input
              id="slug"
              name="slug"
              defaultValue={club?.slug}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={club?.active ?? true} />
            Aktiv (öffentlich sichtbar)
          </label>
        </div>
      ) : (
        <p className="text-sm text-neutral-600">
          Vereinsname: <strong>{club?.name}</strong> – Name und URL ändert der Verband.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kurzname" htmlFor="shortName" error={err.shortName}>
          <Input id="shortName" name="shortName" defaultValue={club?.shortName ?? ""} />
        </Field>
        <Field label="Website" htmlFor="website" error={err.website}>
          <Input
            id="website"
            name="website"
            type="url"
            placeholder="https://"
            defaultValue={club?.website ?? ""}
          />
        </Field>
        <Field label="E-Mail" htmlFor="email" error={err.email}>
          <Input id="email" name="email" type="email" defaultValue={club?.email ?? ""} />
        </Field>
        <Field label="Telefon" htmlFor="phone" error={err.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={club?.phone ?? ""} />
        </Field>
        <Field label="Straße" htmlFor="street" error={err.street}>
          <Input id="street" name="street" defaultValue={club?.street ?? ""} />
        </Field>
        <div className="grid grid-cols-[8rem_1fr] gap-4">
          <Field label="PLZ" htmlFor="postalCode" error={err.postalCode}>
            <Input id="postalCode" name="postalCode" defaultValue={club?.postalCode ?? ""} />
          </Field>
          <Field label="Ort" htmlFor="city" error={err.city}>
            <Input id="city" name="city" defaultValue={club?.city ?? ""} />
          </Field>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Sportarten</legend>
        <div className="flex flex-wrap gap-4">
          {SPORTS.map((sport) => (
            <label key={sport} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="sports"
                value={sport}
                defaultChecked={club?.sports.includes(sport)}
              />
              {EVENT_CALENDAR_LABELS[sport]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Trainingsstätte(n)" htmlFor="venue" error={err.venue}>
        <Textarea id="venue" name="venue" defaultValue={club?.venue ?? ""} />
      </Field>
      <Field
        label="Beschreibung"
        htmlFor="description"
        error={err.description}
        hint="Wird auf der Vereinsseite angezeigt."
      >
        <Textarea
          id="description"
          name="description"
          defaultValue={club?.description ?? ""}
          className="min-h-40"
        />
      </Field>

      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.message && <Alert variant="success">{state.message}</Alert>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Wird gespeichert …" : mode === "create" ? "Verein anlegen" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
