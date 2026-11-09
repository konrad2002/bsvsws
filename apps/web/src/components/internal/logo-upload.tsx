"use client";

import { Button } from "@bsv-sws/ui/components/button";
import { Alert, Field, Input } from "@bsv-sws/ui/components/form";
import { useActionState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import { removeLogoAction, uploadLogoAction } from "@/lib/club-actions";

export function LogoUpload({
  clubId,
  logoId,
  clubName,
}: {
  clubId: string;
  logoId: string | null;
  clubName: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    uploadLogoAction.bind(null, clubId),
    {},
  );
  const [removing, startRemove] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {logoId ? (
        // eslint-disable-next-line @next/next/no-img-element -- proxied asset, sizes unknown
        <img
          src={`/api/clubs/${clubId}/logo?v=${logoId}`}
          alt={`Logo ${clubName}`}
          className="h-24 w-24 rounded border object-contain"
        />
      ) : (
        <p className="text-sm text-muted-foreground">Noch kein Logo hinterlegt.</p>
      )}
      <form action={action} className="flex flex-wrap items-end gap-3">
        <Field label="Logo hochladen" htmlFor="logo" hint="PNG, JPEG oder WebP, max. 2 MB.">
          <Input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
          />
        </Field>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Lädt …" : "Hochladen"}
        </Button>
        {logoId && (
          <Button
            variant="ghost"
            disabled={removing}
            onClick={() => startRemove(async () => void (await removeLogoAction(clubId)))}
          >
            Logo entfernen
          </Button>
        )}
      </form>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.message && <Alert variant="success">{state.message}</Alert>}
    </div>
  );
}
