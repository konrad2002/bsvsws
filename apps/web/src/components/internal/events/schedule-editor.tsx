"use client";

import {
  SCHEDULE_ENTRY_TYPE_LABELS,
  SCHEDULE_ENTRY_TYPES,
  type ScheduleEntryType,
} from "@bsv-sws/shared";
import { Button } from "@bsv-sws/ui/components/button";
import { Input, Select } from "@bsv-sws/ui/components/form";
import { useState } from "react";

export interface ScheduleRow {
  key: string;
  date: string;
  time: string;
  endTime: string;
  type: ScheduleEntryType;
  title: string;
  description: string;
}

let counter = 0;
const newKey = () => `row-${++counter}`;

/**
 * Hybrid schedule (spec §7.6): predefined types plus free entries. Rows are kept
 * in state and serialised into the hidden `scheduleJson` field of the form.
 */
export function ScheduleEditor({
  initial,
  multiDay,
}: {
  initial: Omit<ScheduleRow, "key">[];
  multiDay: boolean;
}) {
  const [rows, setRows] = useState<ScheduleRow[]>(() =>
    initial.map((r) => ({ ...r, key: newKey() })),
  );
  const update = (key: string, patch: Partial<ScheduleRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) =>
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(index, 1);
      next.splice(index + delta, 0, row!);
      return next;
    });

  const serialised = JSON.stringify(
    rows
      .filter((r) => r.title.trim())
      .map(({ date, time, endTime, type, title, description }) => ({
        date: date || null,
        time,
        endTime,
        type,
        title,
        description,
      })),
  );

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="scheduleJson" value={serialised} />
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch kein Ablauf erfasst.</p>
      )}
      {rows.map((row, i) => (
        <div
          key={row.key}
          className="grid gap-2 rounded border p-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
        >
          <Select
            aria-label="Typ des Eintrags"
            value={row.type}
            onChange={(e) => {
              const type = e.target.value as ScheduleEntryType;
              const keepTitle = row.title && row.title !== SCHEDULE_ENTRY_TYPE_LABELS[row.type];
              update(row.key, {
                type,
                title:
                  keepTitle || type === "custom" ? row.title : SCHEDULE_ENTRY_TYPE_LABELS[type],
              });
            }}
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
            className="sm:col-span-3"
          />
          <div className="flex gap-1 sm:row-span-2 sm:flex-col">
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
          {multiDay ? (
            <Input
              aria-label="Tag des Eintrags"
              type="date"
              value={row.date}
              onChange={(e) => update(row.key, { date: e.target.value })}
            />
          ) : (
            <span className="hidden sm:block" />
          )}
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
          />
        </div>
      ))}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((rs) => [
              ...rs,
              {
                key: newKey(),
                date: "",
                time: "",
                endTime: "",
                type: "custom",
                title: "",
                description: "",
              },
            ])
          }
        >
          Eintrag hinzufügen
        </Button>
      </div>
    </div>
  );
}
