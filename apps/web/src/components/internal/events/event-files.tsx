"use client";

import { Button } from "@bsv-sws/ui/components/button";
import { Alert, Field, Input } from "@bsv-sws/ui/components/form";
import type { EventDetail } from "@bsv-sws/validation";
import { useActionState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import {
  removeEventFileAction,
  removeEventImageAction,
  setEventImageAction,
  uploadEventFileAction,
} from "@/lib/event-actions";
import { formatFileSize } from "@/lib/format";

/** Event attachments: file + description, no type taxonomy (spec §7.2). */
export function EventFiles({ event, editable }: { event: EventDetail; editable: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    uploadEventFileAction.bind(null, event.id),
    {},
  );
  const [removing, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {event.files.length === 0 ? (
        <p className="text-sm text-neutral-600">Keine Dateien.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded border">
          {event.files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <a href={`/api/events/${event.id}/files/${f.id}`} className="hover:underline">
                {f.description}
                <span className="ml-2 text-neutral-500">
                  {f.filename} {formatFileSize(f.size)}
                </span>
              </a>
              {editable && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={removing}
                  onClick={() =>
                    start(async () => void (await removeEventFileAction(event.id, f.id)))
                  }
                >
                  Entfernen
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field
            label="Beschreibung"
            htmlFor="file-description"
            error={state.fieldErrors?.description}
            className="flex-1"
          >
            <Input
              id="file-description"
              name="description"
              placeholder="z. B. Ausschreibung"
              required
            />
          </Field>
          <Field
            label="Datei"
            htmlFor="file-upload"
            hint="PDF, Office, Text, ZIP oder Bild, max. 20 MB."
          >
            <Input id="file-upload" name="file" type="file" required />
          </Field>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Lädt …" : "Hinzufügen"}
          </Button>
        </form>
      )}
      {state.error && <Alert variant="error">{state.error}</Alert>}
    </div>
  );
}

function ImageSlot({
  event,
  kind,
  label,
  editable,
}: {
  event: EventDetail;
  kind: "title_image" | "logo";
  label: string;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setEventImageAction.bind(null, event.id, kind),
    {},
  );
  const [removing, start] = useTransition();
  const fileId = kind === "logo" ? event.logo : event.titleImage;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {fileId ? (
        // eslint-disable-next-line @next/next/no-img-element -- proxied asset
        <img
          src={`/api/events/${event.id}/images/${kind}?v=${fileId}`}
          alt={label}
          className="h-32 w-auto max-w-full rounded border object-contain"
        />
      ) : (
        <p className="text-sm text-neutral-600">Nicht hinterlegt.</p>
      )}
      {editable && (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <Input
            aria-label={`${label} hochladen`}
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="max-w-64"
          />
          <Button size="sm" type="submit" variant="outline" disabled={pending}>
            Hochladen
          </Button>
          {fileId && (
            <Button
              size="sm"
              variant="ghost"
              disabled={removing}
              onClick={() => start(async () => void (await removeEventImageAction(event.id, kind)))}
            >
              Entfernen
            </Button>
          )}
        </form>
      )}
      {state.error && <Alert variant="error">{state.error}</Alert>}
    </div>
  );
}

export function EventImages({ event, editable }: { event: EventDetail; editable: boolean }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <ImageSlot event={event} kind="title_image" label="Titelbild" editable={editable} />
      <ImageSlot event={event} kind="logo" label="Logo" editable={editable} />
    </div>
  );
}
