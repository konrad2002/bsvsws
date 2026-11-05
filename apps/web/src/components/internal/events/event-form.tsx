"use client";

import {
  EVENT_CALENDAR_LABELS,
  EVENT_CALENDARS,
  ORGANIZER_TYPE_LABELS,
  type OrganizerType,
} from "@bsv-sws/shared";
import { Button } from "@bsv-sws/ui/components/button";
import { Alert, Field, Input, Select, Textarea } from "@bsv-sws/ui/components/form";
import type { Club, EventCategory, EventDetail } from "@bsv-sws/validation";
import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { createEventAction, updateEventAction } from "@/lib/event-actions";
import { ScheduleEditor } from "./schedule-editor";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Event form for create and edit. Locked fields (published events, club users)
 * are disabled – Fastify enforces the same rule (spec §7.9).
 */
export function EventForm({
  event,
  categories,
  federation,
  clubs,
  clubName,
}: {
  event?: EventDetail;
  categories: EventCategory[];
  federation: boolean;
  /** Federation only: clubs for "owning club" selection. */
  clubs?: Pick<Club, "id" | "name">[];
  /** Representative's club (display only). */
  clubName?: string;
}) {
  const action = event ? updateEventAction.bind(null, event.id) : createEventAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const [allDay, setAllDay] = useState(event?.allDay ?? true);
  const [startDate, setStartDate] = useState(event?.startDate ?? "");
  const [endDate, setEndDate] = useState(event?.endDate ?? "");
  const [organizerType, setOrganizerType] = useState<OrganizerType>(
    event?.organizerType ?? (federation ? "federation" : "club"),
  );
  const locked = new Set(event?.lockedFields ?? []);
  const err = state.fieldErrors ?? {};
  const selectedCategories = new Set(event?.categories.map((c) => c.id) ?? []);
  const organizerOptions: OrganizerType[] = federation
    ? ["federation", "club", "external"]
    : ["club", "external"];

  return (
    <form action={formAction} className="flex max-w-5xl flex-col gap-6">
      <Group title="Allgemein">
        <Field
          label="Titel"
          htmlFor="title"
          error={err.title}
          hint={locked.has("title") ? "Nach der Veröffentlichung gesperrt." : undefined}
        >
          <Input
            id="title"
            name="title"
            defaultValue={event?.title}
            required
            disabled={locked.has("title")}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kalender" htmlFor="calendar" error={err.calendar}>
            <Select id="calendar" name="calendar" defaultValue={event?.calendar ?? ""} required>
              <option value="" disabled>
                Bitte wählen
              </option>
              {EVENT_CALENDARS.map((c) => (
                <option key={c} value={c}>
                  {EVENT_CALENDAR_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Veranstalter" htmlFor="organizerType" error={err.organizerType}>
            <Select
              id="organizerType"
              name="organizerType"
              value={organizerType}
              onChange={(e) => setOrganizerType(e.target.value as OrganizerType)}
            >
              {organizerOptions.map((o) => (
                <option key={o} value={o}>
                  {o === "club" && clubName ? clubName : ORGANIZER_TYPE_LABELS[o]}
                </option>
              ))}
            </Select>
          </Field>
          {organizerType === "external" && (
            <Field
              label="Name des Veranstalters"
              htmlFor="organizerName"
              error={err.organizerName}
              className="sm:col-span-2"
            >
              <Input
                id="organizerName"
                name="organizerName"
                defaultValue={event?.organizerName ?? ""}
              />
            </Field>
          )}
          {federation && (
            <>
              <Field
                label="Zugeordneter Verein"
                htmlFor="clubId"
                error={err.clubId}
                hint="Leer = Veranstaltung des Verbands."
              >
                <Select id="clubId" name="clubId" defaultValue={event?.club?.id ?? ""}>
                  <option value="">– Verband –</option>
                  {clubs?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="official" defaultChecked={event?.official ?? true} />
                Offizielle Veranstaltung
              </label>
            </>
          )}
        </div>
        {categories.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Kategorien</legend>
            <div className="flex flex-wrap gap-4">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={c.id}
                    defaultChecked={selectedCategories.has(c.id)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </Group>

      <Group title="Datum und Zeit">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Beginn (Datum)" htmlFor="startDate" error={err.startDate}>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
              }}
              required
              disabled={locked.has("startDate")}
            />
          </Field>
          <Field label="Ende (Datum)" htmlFor="endDate" error={err.endDate}>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              disabled={locked.has("endDate")}
            />
          </Field>
        </div>
        {locked.has("startDate") && (
          <p className="text-xs text-muted-foreground">
            Die Kalenderdaten sind nach der Veröffentlichung gesperrt; Uhrzeiten können geändert
            werden.
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="allDay"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          Ganztägig
        </label>
        {!allDay && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Beginn (Uhrzeit)" htmlFor="startTime" error={err.startTime}>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                defaultValue={event?.startTime ?? ""}
              />
            </Field>
            <Field label="Ende (Uhrzeit)" htmlFor="endTime" error={err.endTime}>
              <Input id="endTime" name="endTime" type="time" defaultValue={event?.endTime ?? ""} />
            </Field>
          </div>
        )}
      </Group>

      <Group title="Ort">
        <Field label="Schwimmhalle / Veranstaltungsort" htmlFor="venue" error={err.venue}>
          <Input id="venue" name="venue" defaultValue={event?.venue ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[2fr_8rem_2fr]">
          <Field label="Straße" htmlFor="street" error={err.street}>
            <Input id="street" name="street" defaultValue={event?.street ?? ""} />
          </Field>
          <Field label="PLZ" htmlFor="postalCode" error={err.postalCode}>
            <Input id="postalCode" name="postalCode" defaultValue={event?.postalCode ?? ""} />
          </Field>
          <Field label="Ort" htmlFor="city" error={err.city}>
            <Input id="city" name="city" defaultValue={event?.city ?? ""} />
          </Field>
        </div>
      </Group>

      <Group title="Informationen">
        <Field label="Beschreibung" htmlFor="description" error={err.description}>
          <Textarea
            id="description"
            name="description"
            defaultValue={event?.description ?? ""}
            className="min-h-32"
          />
        </Field>
        <Field label="Zulassung / Meldung" htmlFor="admissionInfo" error={err.admissionInfo}>
          <Textarea
            id="admissionInfo"
            name="admissionInfo"
            defaultValue={event?.admissionInfo ?? ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Website" htmlFor="website" error={err.website}>
            <Input
              id="website"
              name="website"
              type="url"
              placeholder="https://"
              defaultValue={event?.website ?? ""}
            />
          </Field>
          <Field label="Ergebnisdienst" htmlFor="resultsService" error={err.resultsService}>
            <Input
              id="resultsService"
              name="resultsService"
              defaultValue={event?.resultsService ?? ""}
            />
          </Field>
          <Field
            label="SwimResults-ID"
            htmlFor="swimresultsId"
            error={err.swimresultsId}
            hint="z. B. IESC26 – blendet Livetiming, Ergebnisse, Ablauf und Dateien aus SwimResults ein."
          >
            <Input
              id="swimresultsId"
              name="swimresultsId"
              defaultValue={event?.swimresultsId ?? ""}
            />
          </Field>
        </div>
        <Field
          label="Weitere Hinweise"
          htmlFor="additionalInfo"
          error={err.additionalInfo}
          hint="z. B. Spinde, Ausrüstung, Hinweise zur Halle"
        >
          <Textarea
            id="additionalInfo"
            name="additionalInfo"
            defaultValue={event?.additionalInfo ?? ""}
          />
        </Field>
      </Group>

      <Group title="Ablauf">
        <p className="text-sm text-muted-foreground">
          Ist eine SwimResults-ID gesetzt, zeigt die Veranstaltungsseite Ablauf und Dateien aus
          SwimResults, sobald dort Daten vorliegen. Die Angaben hier gelten bis dahin bzw. ohne
          SwimResults.
        </p>
        {err.schedule && (
          <Alert variant="error">
            {err.schedule.map((m) => (
              <div key={m}>{m}</div>
            ))}
          </Alert>
        )}
        <ScheduleEditor
          multiDay={!!startDate && !!endDate && startDate !== endDate}
          defaultDate={startDate ?? ""}
          initial={event?.schedule ?? []}
        />
      </Group>

      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.message && <Alert variant="success">{state.message}</Alert>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Wird gespeichert …" : event ? "Speichern" : "Als Entwurf anlegen"}
        </Button>
      </div>
    </form>
  );
}
