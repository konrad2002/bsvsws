"use client";

import { MEMBERSHIP_ROLE_LABELS } from "@bsv-sws/shared";
import { Button } from "@bsv-sws/ui/components/button";
import { Alert, Badge } from "@bsv-sws/ui/components/form";
import type { ClubMember } from "@bsv-sws/validation";
import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import { changeRoleAction, removeMemberAction } from "@/lib/club-actions";

/**
 * Club members with promote/demote/remove. Representatives cannot change
 * themselves (owner decision) – buttons are hidden, Fastify enforces it.
 */
export function MembersTable({
  members,
  currentUserId,
  isFederation,
}: {
  members: ClubMember[];
  currentUserId: string;
  isFederation: boolean;
}) {
  const [result, setResult] = useState<ActionState>({});
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionState>) => start(async () => setResult(await fn()));

  if (members.length === 0)
    return <p className="text-sm text-muted-foreground">Noch keine Mitglieder.</p>;

  return (
    <div className="flex flex-col gap-3">
      {result.error && <Alert variant="error">{result.error}</Alert>}
      <div className="overflow-x-auto">
        <table className="data-table min-w-[36rem] text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Rolle</th>
              <th>
                <span className="sr-only">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const self = m.userId === currentUserId;
              const canChange = isFederation || !self;
              const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || "–";
              return (
                <tr key={m.membershipId}>
                  <td>
                    {name} {self && <span className="text-muted-foreground">(du)</span>}
                  </td>
                  <td>{m.email}</td>
                  <td>
                    <Badge>{MEMBERSHIP_ROLE_LABELS[m.role]}</Badge>
                  </td>
                  <td>
                    {canChange && (
                      <div className="flex flex-wrap justify-end gap-2">
                        {m.role === "member" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              run(() => changeRoleAction(m.membershipId, "representative"))
                            }
                          >
                            Zum Vertreter machen
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => run(() => changeRoleAction(m.membershipId, "member"))}
                          >
                            Vertreterrechte entziehen
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => {
                            if (
                              confirm(
                                `${name} aus dem Verein entfernen? Das Benutzerkonto bleibt bestehen.`,
                              )
                            ) {
                              run(() => removeMemberAction(m.membershipId));
                            }
                          }}
                        >
                          Entfernen
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
    </div>
  );
}
