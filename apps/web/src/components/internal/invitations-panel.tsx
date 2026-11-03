"use client";

import { MEMBERSHIP_ROLE_LABELS } from "@bsv-sws/shared";
import { Button } from "@bsv-sws/ui/components/button";
import { Alert, Badge, Field, Input, Select } from "@bsv-sws/ui/components/form";
import type { InvitationDisplayStatus, InvitationSummary } from "@bsv-sws/validation";
import { useActionState, useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import {
  inviteAction,
  resendInvitationAction,
  revokeInvitationAction,
  type InviteResult,
} from "@/lib/club-actions";

const STATUS_LABELS: Record<InvitationDisplayStatus, string> = {
  pending: "Offen",
  expired: "Abgelaufen",
  accepted: "Angenommen",
  revoked: "Zurückgezogen",
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "–";

/** One-time display of a freshly generated link (only its hash is stored). */
function LinkResult({ result }: { result: InviteResult }) {
  const [copied, setCopied] = useState(false);
  return (
    <Alert variant="success" className="flex flex-col gap-2">
      <span>
        Einladung für <strong>{result.email}</strong>{" "}
        {result.emailSent
          ? "wurde per E-Mail versendet."
          : "wurde erstellt (keine E-Mail versendet)."}{" "}
        Du kannst den Link auch selbst weitergeben – er wird nur jetzt angezeigt:
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all rounded bg-white px-2 py-1 text-xs">{result.link}</code>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(result.link);
            setCopied(true);
          }}
        >
          {copied ? "Kopiert" : "Link kopieren"}
        </Button>
      </div>
    </Alert>
  );
}

export function InvitationsPanel({
  clubId,
  invitations,
  allowRepresentativeInvites,
}: {
  clubId: string;
  invitations: InvitationSummary[];
  /** Only the federation may invite representatives (spec §5.1). */
  allowRepresentativeInvites: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState<InviteResult>, FormData>(
    inviteAction.bind(null, clubId),
    {},
  );
  const [rowResult, setRowResult] = useState<ActionState<InviteResult | undefined>>({});
  const [rowPending, start] = useTransition();
  const run = (fn: () => Promise<ActionState<InviteResult | undefined>>) =>
    start(async () => setRowResult(await fn()));
  const shown = rowResult.data ?? state.data;

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          label="E-Mail-Adresse"
          htmlFor="invite-email"
          error={state.fieldErrors?.email}
          className="flex-1"
        >
          <Input id="invite-email" name="email" type="email" required />
        </Field>
        <Field label="Rolle" htmlFor="invite-role">
          <Select id="invite-role" name="role" defaultValue="member">
            <option value="member">{MEMBERSHIP_ROLE_LABELS.member}</option>
            {allowRepresentativeInvites && (
              <option value="representative">{MEMBERSHIP_ROLE_LABELS.representative}</option>
            )}
          </Select>
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="sendEmail" defaultChecked />
          per E-Mail senden
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Wird erstellt …" : "Einladen"}
        </Button>
      </form>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {rowResult.error && <Alert variant="error">{rowResult.error}</Alert>}
      {shown && <LinkResult result={shown} />}

      {invitations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b">
              <tr>
                <th className="py-2 pr-4 font-medium">E-Mail</th>
                <th className="py-2 pr-4 font-medium">Rolle</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Gültig bis</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => {
                const open = inv.status === "pending" || inv.status === "expired";
                const manageable = open && (allowRepresentativeInvites || inv.role === "member");
                return (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{inv.email}</td>
                    <td className="py-2 pr-4">{MEMBERSHIP_ROLE_LABELS[inv.role]}</td>
                    <td className="py-2 pr-4">
                      <Badge>{STATUS_LABELS[inv.status]}</Badge>
                    </td>
                    <td className="py-2 pr-4">{open ? formatDate(inv.expiresAt) : "–"}</td>
                    <td className="py-2">
                      {manageable && (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rowPending}
                            onClick={() => run(() => resendInvitationAction(inv.id, true))}
                          >
                            Erneut senden
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rowPending}
                            onClick={() => run(() => resendInvitationAction(inv.id, false))}
                          >
                            Neuer Link
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={rowPending}
                            onClick={() => run(() => revokeInvitationAction(inv.id))}
                          >
                            Zurückziehen
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
