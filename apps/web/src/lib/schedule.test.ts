import type { ScheduleEntry } from "@bsv-sws/validation";
import { describe, expect, it } from "vitest";
import { groupSchedule, raceLabel, sectionLabel } from "./schedule";

const entry = (patch: Partial<ScheduleEntry>): ScheduleEntry => ({
  kind: "item",
  number: null,
  date: null,
  time: null,
  endTime: null,
  type: "custom",
  title: null,
  description: null,
  distance: null,
  relay: null,
  stroke: null,
  gender: null,
  ...patch,
});

describe("groupSchedule", () => {
  it("groups entries by section and keeps leading entries without section", () => {
    const groups = groupSchedule([
      entry({ title: "Einlass" }),
      entry({ kind: "section", number: 1 }),
      entry({ kind: "race", number: 1 }),
      entry({ kind: "section", number: 2 }),
    ]);
    expect(groups.map((g) => [g.section?.number ?? null, g.entries.length])).toEqual([
      [null, 1],
      [1, 1],
      [2, 0],
    ]);
  });
});

describe("labels", () => {
  it("formats races and sections", () => {
    expect(raceLabel(entry({ distance: 100, stroke: "butterfly", gender: "female" }))).toBe(
      "100 m Schmetterling weiblich",
    );
    expect(
      raceLabel(
        entry({
          distance: 200,
          relay: "4x50",
          stroke: "freestyle",
          gender: "mixed",
          title: "Finale",
        }),
      ),
    ).toBe("4×50 m Freistil mixed Finale");
    expect(raceLabel(entry({ distance: 25, stroke: "other", title: "Apnoe" }))).toBe("25 m Apnoe");
    expect(sectionLabel(entry({ number: 2, title: "Vormittag" }))).toBe("Abschnitt 2 – Vormittag");
  });
});
