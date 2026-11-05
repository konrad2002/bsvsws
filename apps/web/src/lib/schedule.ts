import {
  RACE_GENDER_LABELS,
  RACE_STROKE_LABELS,
  SCHEDULE_ENTRY_TYPE_LABELS,
} from "@bsv-sws/shared";
import type { ScheduleEntry } from "@bsv-sws/validation";

/** Schedule presentation (same for manual and SwimResults data). */

export interface ScheduleGroup {
  /** null = entries before the first section (events without sections). */
  section: ScheduleEntry | null;
  entries: ScheduleEntry[];
}

/** Splits the ordered list at section rows. */
export function groupSchedule(entries: ScheduleEntry[]): ScheduleGroup[] {
  const groups: ScheduleGroup[] = [];
  for (const e of entries) {
    if (e.kind === "section") groups.push({ section: e, entries: [] });
    else if (groups.length === 0) groups.push({ section: null, entries: [e] });
    else groups.at(-1)!.entries.push(e);
  }
  return groups;
}

/** "100 m Schmetterling weiblich", "4×50 m Freistil mixed Finale". */
export function raceLabel(
  e: Pick<ScheduleEntry, "distance" | "relay" | "stroke" | "gender" | "title">,
) {
  const distance = e.relay
    ? `${e.relay.replace("x", "×")} m`
    : e.distance
      ? `${e.distance} m`
      : null;
  const stroke = e.stroke && e.stroke !== "other" ? RACE_STROKE_LABELS[e.stroke] : null;
  return [distance, stroke, e.gender ? RACE_GENDER_LABELS[e.gender] : null, e.title]
    .filter(Boolean)
    .join(" ");
}

/** "Abschnitt 1", optionally with its name. */
export const sectionLabel = (e: Pick<ScheduleEntry, "number" | "title">) =>
  [e.number != null ? `Abschnitt ${e.number}` : "Abschnitt", e.title].filter(Boolean).join(" – ");

/** Item title, falling back to the label of its type. */
export const itemLabel = (e: Pick<ScheduleEntry, "title" | "type">) =>
  e.title || SCHEDULE_ENTRY_TYPE_LABELS[e.type];

export const timeRange = (e: Pick<ScheduleEntry, "time" | "endTime">) =>
  e.time ? `${e.time}${e.endTime ? `–${e.endTime}` : ""}` : "";
