"use client";

import {
  RACE_GENDER_LABELS,
  RACE_GENDERS,
  RACE_STROKE_LABELS,
  RACE_STROKES,
  SCHEDULE_ENTRY_KIND_LABELS,
  SCHEDULE_ENTRY_TYPE_LABELS,
  SCHEDULE_ENTRY_TYPES,
  type ScheduleEntryKind,
  type ScheduleEntryType,
} from "@bsv-sws/shared";
import { Button } from "@bsv-sws/ui/components/button";
import { Input, Select } from "@bsv-sws/ui/components/form";
import type { ScheduleEntry } from "@bsv-sws/validation";
import { useState } from "react";

/** Form state of one row: all values as strings (inputs). */
interface Row {
  key: string;
  kind: ScheduleEntryKind;
  number: string;
  date: string;
  time: string;
  endTime: string;
  type: ScheduleEntryType;
  title: string;
  description: string;
  distance: string;
  relay: string;
  stroke: string;
  gender: string;
}

let counter = 0;
const newKey = () => `row-${++counter}`;

const toRow = (e: ScheduleEntry): Row => ({
  key: newKey(),
  kind: e.kind,
  number: e.number?.toString() ?? "",
  date: e.date ?? "",
  time: e.time ?? "",
  endTime: e.endTime ?? "",
  type: e.type,
  title: e.title ?? "",
  description: e.description ?? "",
  distance: e.distance?.toString() ?? "",
  relay: e.relay ?? "",
  stroke: e.stroke ?? "",
  gender: e.gender ?? "",
});

const int = (v: string) => (v.trim() === "" ? null : Number(v));
const isBlank = (r: Row) =>
  r.kind === "item" ? !r.title.trim() : r.kind === "race" ? !r.number && !r.distance : !r.number;

/** Next number for a new section/race: last of that kind + 1. */
const nextNumber = (rows: Row[], kind: ScheduleEntryKind) =>
  String(Math.max(0, ...rows.filter((r) => r.kind === kind).map((r) => Number(r.number) || 0)) + 1);

/**
 * Schedule editor (spec §7.6, SwimResults model): sections (Abschnitte), races
 * (Wettkämpfe) and programme items in one ordered list. Rows are serialised into
 * the hidden `scheduleJson` field; empty rows are dropped.
 */
export function ScheduleEditor({
  initial,
  multiDay,
  defaultDate,
}: {
  initial: ScheduleEntry[];
  multiDay: boolean;
  /** Date for the first new section (the event's start date). */
  defaultDate: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));
  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) =>
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(index, 1);
      next.splice(index + delta, 0, row!);
      return next;
    });

  const add = (kind: ScheduleEntryKind) =>
    setRows((rs) => {
      const lastSection = rs.findLast((r) => r.kind === "section");
      const lastRace = rs.findLast((r) => r.kind === "race");
      const blank: Row = {
        key: newKey(),
        kind,
        number: "",
        date: "",
        time: "",
        endTime: "",
        type: "custom",
        title: "",
        description: "",
        distance: "",
        relay: "",
        stroke: "",
        gender: "",
      };
      if (kind === "section")
        return [
          ...rs,
          { ...blank, number: nextNumber(rs, kind), date: lastSection?.date || defaultDate },
        ];
      if (kind === "race")
        // Pre-fill like the previous race: races usually come in pairs (w/m).
        return [
          ...rs,
          {
            ...blank,
            number: nextNumber(rs, kind),
            distance: lastRace?.distance ?? "",
            relay: lastRace?.relay ?? "",
            stroke: lastRace?.stroke ?? "",
          },
        ];
      return [...rs, blank];
    });

  const serialised = JSON.stringify(
    rows
      .filter((r) => !isBlank(r))
      .map((r) => ({
        kind: r.kind,
        number: int(r.number),
        date: r.date || null,
        time: r.time,
        endTime: r.endTime,
        type: r.type,
        title: r.title,
        description: r.description,
        distance: int(r.distance),
        relay: r.relay,
        stroke: r.stroke || null,
        gender: r.gender || null,
      })),
  );

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="scheduleJson" value={serialised} />
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch kein Ablauf erfasst.</p>
      )}
      {rows.map((row, i) => (
        <div
          key={row.key}
          className={`flex flex-col gap-2 rounded border p-2 sm:flex-row sm:items-start ${
            row.kind === "section" ? "mt-2 bg-muted" : "sm:ml-6"
          }`}
        >
          <span className="w-28 shrink-0 py-2 text-sm font-medium">
            {SCHEDULE_ENTRY_KIND_LABELS[row.kind]}
          </span>
          <div
            className={`grid flex-1 gap-2 ${
              row.kind === "race"
                ? "grid-cols-3 sm:grid-cols-[4.5rem_5.5rem_6.5rem_repeat(3,minmax(0,1fr))]"
                : "sm:grid-cols-6"
            }`}
          >
            {row.kind === "section" && <SectionFields row={row} update={update} />}
            {row.kind === "race" && <RaceFields row={row} update={update} />}
            {row.kind === "item" && <ItemFields row={row} update={update} multiDay={multiDay} />}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Nach oben"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              ↑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Nach unten"
              disabled={i === rows.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Entfernen"
              onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
            >
              ✕
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => add("section")}>
          Abschnitt hinzufügen
        </Button>
        <Button variant="outline" size="sm" onClick={() => add("race")}>
          Wettkampf hinzufügen
        </Button>
        <Button variant="outline" size="sm" onClick={() => add("item")}>
          Programmpunkt hinzufügen
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Abschnitte gliedern den Ablauf (z. B. je Tag oder Vor-/Nachmittag). Programmpunkte sind
        Einschwimmen, Sitzungen, Pausen, Siegerehrungen usw.; sie stehen an der Stelle im Ablauf, an
        der sie stattfinden.
      </p>
    </div>
  );
}

type Update = (key: string, patch: Partial<Row>) => void;

function SectionFields({ row, update }: { row: Row; update: Update }) {
  return (
    <>
      <Input
        aria-label="Abschnittsnummer"
        placeholder="Nr."
        type="number"
        min={0}
        value={row.number}
        onChange={(e) => update(row.key, { number: e.target.value })}
      />
      <Input
        aria-label="Datum des Abschnitts"
        type="date"
        value={row.date}
        onChange={(e) => update(row.key, { date: e.target.value })}
        className="sm:col-span-2"
      />
      <Input
        aria-label="Beginn des Abschnitts"
        type="time"
        value={row.time}
        onChange={(e) => update(row.key, { time: e.target.value })}
      />
      <Input
        aria-label="Bezeichnung des Abschnitts"
        placeholder="Bezeichnung (optional)"
        value={row.title}
        onChange={(e) => update(row.key, { title: e.target.value })}
        className="sm:col-span-2"
      />
    </>
  );
}

function RaceFields({ row, update }: { row: Row; update: Update }) {
  return (
    <>
      <Input
        aria-label="Wettkampfnummer"
        placeholder="Nr."
        type="number"
        min={0}
        value={row.number}
        onChange={(e) => update(row.key, { number: e.target.value })}
      />
      <Input
        aria-label="Strecke in Metern"
        placeholder="Meter"
        type="number"
        min={0}
        value={row.distance}
        onChange={(e) => update(row.key, { distance: e.target.value })}
      />
      <Input
        aria-label="Staffel"
        placeholder="Staffel 4x50"
        value={row.relay}
        onChange={(e) => update(row.key, { relay: e.target.value })}
      />
      <Select
        aria-label="Lage"
        value={row.stroke}
        onChange={(e) => update(row.key, { stroke: e.target.value })}
      >
        <option value="">Lage</option>
        {RACE_STROKES.map((s) => (
          <option key={s} value={s}>
            {RACE_STROKE_LABELS[s]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Geschlecht"
        value={row.gender}
        onChange={(e) => update(row.key, { gender: e.target.value })}
      >
        <option value="">Geschlecht</option>
        {RACE_GENDERS.map((g) => (
          <option key={g} value={g}>
            {RACE_GENDER_LABELS[g]}
          </option>
        ))}
      </Select>
      <Input
        aria-label="Zusatz zum Wettkampf"
        placeholder={row.stroke === "other" ? "Bezeichnung" : "Zusatz"}
        value={row.title}
        onChange={(e) => update(row.key, { title: e.target.value })}
      />
    </>
  );
}

function ItemFields({ row, update, multiDay }: { row: Row; update: Update; multiDay: boolean }) {
  return (
    <>
      <Select
        aria-label="Typ des Eintrags"
        value={row.type}
        onChange={(e) => {
          const type = e.target.value as ScheduleEntryType;
          const keepTitle = row.title && row.title !== SCHEDULE_ENTRY_TYPE_LABELS[row.type];
          update(row.key, {
            type,
            title: keepTitle || type === "custom" ? row.title : SCHEDULE_ENTRY_TYPE_LABELS[type],
          });
        }}
        className="sm:col-span-2"
      >
        {SCHEDULE_ENTRY_TYPES.map((t) => (
          <option key={t} value={t}>
            {SCHEDULE_ENTRY_TYPE_LABELS[t]}
          </option>
        ))}
      </Select>
      <Input
        aria-label="Titel des Eintrags"
        placeholder="Titel"
        value={row.title}
        onChange={(e) => update(row.key, { title: e.target.value })}
        className="sm:col-span-4"
      />
      {multiDay ? (
        <Input
          aria-label="Tag des Eintrags"
          type="date"
          value={row.date}
          onChange={(e) => update(row.key, { date: e.target.value })}
          className="sm:col-span-2"
        />
      ) : null}
      <Input
        aria-label="Beginn des Eintrags"
        type="time"
        value={row.time}
        onChange={(e) => update(row.key, { time: e.target.value })}
      />
      <Input
        aria-label="Ende des Eintrags"
        type="time"
        value={row.endTime}
        onChange={(e) => update(row.key, { endTime: e.target.value })}
      />
      <Input
        aria-label="Hinweis zum Eintrag"
        placeholder="Hinweis (optional)"
        value={row.description}
        onChange={(e) => update(row.key, { description: e.target.value })}
        className={multiDay ? "sm:col-span-2" : "sm:col-span-4"}
      />
    </>
  );
}
