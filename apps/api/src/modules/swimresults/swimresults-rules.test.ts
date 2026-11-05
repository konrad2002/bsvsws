import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseList,
  srFileSchema,
  srIncidentSchema,
  srPartSchema,
  swimResultsLinks,
  toBerlin,
  toFiles,
  toSchedule,
} from "./swimresults-rules.js";

/** Trimmed real responses of meeting IESC26 (2 parts, first incidents, all files). */
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/iesc26-${name}.json`, import.meta.url), "utf8"));

const parts = parseList(srPartSchema, fixture("parts"));
const incidents = parseList(srIncidentSchema, fixture("incidents"));
const files = parseList(srFileSchema, fixture("files"));

describe("swimResultsLinks", () => {
  it("builds the web app links", () => {
    expect(swimResultsLinks("https://app.swimresults.de/", "IESC26")).toEqual({
      meetingId: "IESC26",
      liveUrl: "https://app.swimresults.de/m/IESC26/live?live=1",
      resultsUrl: "https://app.swimresults.de/m/IESC26/event",
      athletesUrl: "https://app.swimresults.de/m/IESC26/athlete",
    });
  });
});

describe("toBerlin", () => {
  it("converts UTC to Berlin local time (winter and summer time)", () => {
    expect(toBerlin("2026-12-12T06:30:00Z")).toEqual({ date: "2026-12-12", time: "07:30" });
    expect(toBerlin("2026-06-30T22:30:00Z")).toEqual({ date: "2026-07-01", time: "00:30" });
    expect(toBerlin("nonsense")).toBeNull();
  });
});

describe("toSchedule", () => {
  const schedule = toSchedule(parts, incidents);

  it("starts each part with a section and places incidents around their race", () => {
    expect(schedule.slice(0, 6).map((e) => [e.kind, e.type, e.number, e.time])).toEqual([
      ["section", "custom", 1, null],
      ["item", "warm_up", null, "07:30"],
      ["item", "judges_meeting", null, "08:00"],
      ["item", "team_leader_meeting", null, "08:15"],
      ["race", "custom", 1, null],
      ["race", "custom", 2, null],
    ]);
    const breakIndex = schedule.findIndex((e) => e.type === "break");
    expect(schedule[breakIndex - 1]).toMatchObject({ kind: "race", number: 11 });
    expect(schedule[breakIndex]).toMatchObject({ time: "12:00", endTime: "12:30", title: "Pause" });
  });

  it("maps races (distance, relay, stroke, gender)", () => {
    expect(schedule.find((e) => e.number === 1 && e.kind === "race")).toMatchObject({
      distance: 100,
      relay: null,
      stroke: "butterfly",
      gender: "female",
      title: null,
    });
    expect(schedule.find((e) => e.number === 11 && e.kind === "race")).toMatchObject({
      distance: 200,
      relay: "4x50",
      stroke: "freestyle",
      gender: "mixed",
    });
  });

  it("dates a section without own incidents like the previous one", () => {
    const sections = schedule.filter((e) => e.kind === "section");
    expect(sections.map((s) => [s.number, s.date])).toEqual([
      [1, "2026-12-12"],
      [2, "2026-12-12"],
    ]);
  });

  it("keeps unknown strokes/incidents readable and appends unanchored incidents", () => {
    const result = toSchedule(
      [
        {
          number: 1,
          events: [
            { number: 5, distance: 25, style: { name: "APNOE", aliases: ["Apnoe"] }, gender: "X" },
          ],
        },
      ],
      [{ name: "OPENING_CEREMONY", type: "TIMELESS", start: "2026-01-01T09:00:00Z" }],
    );
    expect(result[1]).toMatchObject({
      kind: "race",
      stroke: "other",
      title: "Apnoe",
      gender: null,
    });
    expect(result[2]).toMatchObject({
      kind: "item",
      type: "custom",
      title: "Opening ceremony",
      time: null,
    });
  });

  it("is empty without races", () => {
    expect(toSchedule([], incidents)).toEqual([]);
    expect(parseList(srPartSchema, null)).toEqual([]);
  });
});

describe("toFiles", () => {
  const list = toFiles(files, "https://download.swimresults.de");

  it("labels files by type, sorted by ordering", () => {
    expect(list[0]).toMatchObject({
      type: "meeting_info",
      label: "Ausschreibung",
      extension: "PDF",
      available: true,
      url: "https://download.swimresults.de/IESC26/Ausschreibung_29_IESC_2026.pdf",
    });
    expect(list.map((f) => f.type)).toContain("lenex_definition");
    expect(list[0]!.downloads).toEqual(expect.any(Number));
  });

  it("counts downloads only for SwimResults-hosted files", () => {
    const out = toFiles(
      [
        { name: "MEETING_INFO", path: "/a.pdf", existing: true, downloads: 12 },
        { name: "SOME_FLYER", url: "https://example.org/f.pdf", existing: true, downloads: 3 },
      ],
      "https://download.swimresults.de",
    );
    expect(out.map((f) => f.downloads)).toEqual([12, null]);
  });

  it("lists announced but missing files as unavailable without link", () => {
    const results = list.find((f) => f.type === "results_list");
    expect(results).toMatchObject({ available: false, url: null, label: "Protokoll" });
  });

  it("skips hidden files and non-http URLs", () => {
    const out = toFiles(
      [
        { name: "MEETING_INFO", path: "/a.pdf", existing: true, hidden: true },
        { name: "SOME_FLYER", url: "javascript:alert(1)", existing: true },
      ],
      "https://download.swimresults.de",
    );
    expect(out).toEqual([
      expect.objectContaining({ type: "other", label: "Some flyer", available: false, url: null }),
    ]);
  });
});
