import { CALENDAR_FEED_SLUGS, EVENT_CALENDAR_LABELS, EVENT_CALENDARS } from "@bsv-sws/shared";
import { Button } from "@bsv-sws/ui/components/button";
import { Field, Select } from "@bsv-sws/ui/components/form";
import type { CalendarFilters } from "@bsv-sws/validation";
import Link from "next/link";
import { calendarHref, type CalendarParams } from "./calendar-params";

/** Filter form (plain GET form – works without JavaScript). */
export function CalendarFilterForm({
  params,
  options,
}: {
  params: CalendarParams;
  options: CalendarFilters;
}) {
  const active = params.kalender || params.verein || params.kategorie;
  return (
    <form
      method="get"
      action="/veranstaltungen"
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      {params.ansicht !== "liste" && <input type="hidden" name="ansicht" value={params.ansicht} />}
      {params.ansicht === "monat" && params.monat && (
        <input type="hidden" name="monat" value={params.monat} />
      )}
      {params.ansicht === "jahr" && params.jahr && (
        <input type="hidden" name="jahr" value={params.jahr} />
      )}
      <Field label="Kalender" htmlFor="filter-kalender">
        <Select id="filter-kalender" name="kalender" defaultValue={params.kalender ?? ""}>
          <option value="">Alle Kalender</option>
          {EVENT_CALENDARS.map((c) => (
            <option key={c} value={CALENDAR_FEED_SLUGS[c]}>
              {EVENT_CALENDAR_LABELS[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Verein" htmlFor="filter-verein">
        <Select id="filter-verein" name="verein" defaultValue={params.verein ?? ""}>
          <option value="">Alle Vereine</option>
          {options.clubs.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Kategorie" htmlFor="filter-kategorie">
        <Select id="filter-kategorie" name="kategorie" defaultValue={params.kategorie ?? ""}>
          <option value="">Alle Kategorien</option>
          {options.categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="outline">
        Filtern
      </Button>
      {active && (
        <Link
          href={calendarHref(params, {
            kalender: undefined,
            verein: undefined,
            kategorie: undefined,
          })}
          className="pb-2 text-sm underline"
        >
          Zurücksetzen
        </Link>
      )}
    </form>
  );
}
