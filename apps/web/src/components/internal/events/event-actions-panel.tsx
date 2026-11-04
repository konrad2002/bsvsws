"use client";

import { REMOVAL_TYPE_LABELS, type RemovalType } from "@bsv-sws/shared";
import { Button } from "@bsv-sws/ui/components/button";
import { Alert, Field, Select, Textarea } from "@bsv-sws/ui/components/form";
import type { EventDetail } from "@bsv-sws/validation";
import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import { deleteEventAction, eventWorkflowAction } from "@/lib/event-actions";

type Dialog = "approve" | "reject" | "requestRemoval" | "decideRemoval" | "delete" | null;

/**
 * Workflow buttons for exactly the actions Fastify reports as allowed
 * (`allowedActions`). Approve/reject send the version the reviewer saw.
 */
export function EventActionsPanel({ event }: { event: EventDetail }) {
  const can = new Set(event.allowedActions);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [comment, setComment] = useState("");
  const [removalType, setRemovalType] = useState<RemovalType>("unpublish");
  const [result, setResult] = useState<ActionState>({});
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (!r.error) {
        setDialog(null);
        setComment("");
      }
    });
  const open = (d: Dialog) => {
    setResult({});
    setComment("");
    setDialog(d);
  };

  const buttons = [
    can.has("submit") && (
      <Button
        key="submit"
        disabled={pending}
        onClick={() => run(() => eventWorkflowAction(event.id, "submit"))}
      >
        {event.status === "draft" ? "Zur Freigabe einreichen" : "Erneut einreichen"}
      </Button>
    ),
    can.has("approve") && (
      <Button key="approve" disabled={pending} onClick={() => open("approve")}>
        Freigeben
      </Button>
    ),
    can.has("reject") && (
      <Button key="reject" variant="outline" disabled={pending} onClick={() => open("reject")}>
        Ablehnen
      </Button>
    ),
    can.has("publish") && (
      <Button
        key="publish"
        disabled={pending}
        onClick={() => run(() => eventWorkflowAction(event.id, "publish"))}
      >
        Direkt veröffentlichen
      </Button>
    ),
    can.has("unpublish") && (
      <Button
        key="unpublish"
        variant="outline"
        disabled={pending}
        onClick={() =>
          confirm("Veranstaltung depublizieren? Sie ist dann nicht mehr öffentlich sichtbar.") &&
          run(() => eventWorkflowAction(event.id, "unpublish"))
        }
      >
        Depublizieren
      </Button>
    ),
    can.has("requestRemoval") && (
      <Button
        key="removal"
        variant="outline"
        disabled={pending}
        onClick={() => open("requestRemoval")}
      >
        Entfernung beantragen
      </Button>
    ),
    can.has("decideRemoval") && (
      <Button key="decide" disabled={pending} onClick={() => open("decideRemoval")}>
        Antrag entscheiden
      </Button>
    ),
    (can.has("discard") || can.has("delete")) && (
      <Button key="delete" variant="destructive" disabled={pending} onClick={() => open("delete")}>
        {can.has("discard") ? "Verwerfen" : "Löschen"}
      </Button>
    ),
  ].filter(Boolean);

  if (buttons.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <div className="flex flex-wrap gap-2">{buttons}</div>
      {result.error && <Alert variant="error">{result.error}</Alert>}

      {dialog === "approve" && (
        <div className="flex flex-col gap-3">
          <Field label="Kommentar (optional)" htmlFor="approve-comment">
            <Textarea
              id="approve-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                run(() =>
                  eventWorkflowAction(event.id, "approve", {
                    version: event.updatedAt,
                    comment: comment || undefined,
                  }),
                )
              }
            >
              Freigabe bestätigen
            </Button>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {dialog === "reject" && (
        <div className="flex flex-col gap-3">
          <Field
            label="Ablehnungsgrund"
            htmlFor="reject-comment"
            hint="Wird dem Verein angezeigt und per E-Mail gesendet."
          >
            <Textarea
              id="reject-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
            />
          </Field>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={pending || comment.trim().length < 3}
              onClick={() =>
                run(() =>
                  eventWorkflowAction(event.id, "reject", { version: event.updatedAt, comment }),
                )
              }
            >
              Ablehnen
            </Button>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {dialog === "requestRemoval" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Die Veranstaltung bleibt öffentlich sichtbar, bis der Verband entschieden hat.
          </p>
          <Field label="Art" htmlFor="removal-type">
            <Select
              id="removal-type"
              value={removalType}
              onChange={(e) => setRemovalType(e.target.value as RemovalType)}
            >
              {(["unpublish", "delete"] as const).map((t) => (
                <option key={t} value={t}>
                  {REMOVAL_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Begründung" htmlFor="removal-reason">
            <Textarea
              id="removal-reason"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
            />
          </Field>
          <div className="flex gap-2">
            <Button
              disabled={pending || comment.trim().length < 3}
              onClick={() =>
                run(() =>
                  eventWorkflowAction(event.id, "removal-request", {
                    type: removalType,
                    reason: comment,
                  }),
                )
              }
            >
              Antrag stellen
            </Button>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {dialog === "decideRemoval" && event.pendingRemoval && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Antrag auf <strong>{REMOVAL_TYPE_LABELS[event.pendingRemoval.type]}</strong>
            {event.pendingRemoval.requestedBy
              ? ` von ${event.pendingRemoval.requestedBy}`
              : ""}: {event.pendingRemoval.reason}
          </p>
          <Field label="Kommentar (optional)" htmlFor="decision-comment">
            <Textarea
              id="decision-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                run(() =>
                  eventWorkflowAction(event.id, "removal-decision", {
                    approve: true,
                    comment: comment || undefined,
                  }),
                )
              }
            >
              Genehmigen
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(() =>
                  eventWorkflowAction(event.id, "removal-decision", {
                    approve: false,
                    comment: comment || undefined,
                  }),
                )
              }
            >
              Ablehnen
            </Button>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {dialog === "delete" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {can.has("discard")
              ? "Den Entwurf verwerfen? Er wird aus der Vereinsliste entfernt."
              : "Die Veranstaltung löschen? Sie wird überall ausgeblendet und bleibt nur im Archiv erhalten."}
          </p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => deleteEventAction(event.id, comment || undefined))}
            >
              {can.has("discard") ? "Verwerfen" : "Löschen"}
            </Button>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
