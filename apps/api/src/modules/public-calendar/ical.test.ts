import { describe, expect, it } from "vitest";
import { escapeText, foldLine, renderCalendar, type IcalEvent } from "./ical.js";
import { addDays, zonedToUtc } from "./timezone.js";

const base: IcalEvent = {
  uid: "abc@bsv-sws.de",
  title: "Bezirksmeisterschaften",
  startDate: "2027-05-08",
  endDate: "2027-05-09",
  allDay: true,
  startTime: null,
  endTime: null,
  location: "Stadtbad, Badstraße 1, 09111 Chemnitz",
  description: null,
  url: "https://bsv-sws.de/veranstaltungen/2027-05-08-bm",
  categories: ["Schwimmen", "Wettkampf"],
  lastModified: "2027-04-01T10:00:00.000Z",
};

describe("time zone conversion (Europe/Berlin)", () => {
  it("handles summer and winter time", () => {
    expect(zonedToUtc("2027-07-01", "09:00").toISOString()).toBe("2027-07-01T07:00:00.000Z"); // CEST +2
    expect(zonedToUtc("2027-01-15", "09:00").toISOString()).toBe("2027-01-15T08:00:00.000Z"); // CET +1
  });

  it("handles DST switch days", () => {
    expect(zonedToUtc("2027-03-28", "12:00").toISOString()).toBe("2027-03-28T10:00:00.000Z");
    expect(zonedToUtc("2027-10-31", "12:00").toISOString()).toBe("2027-10-31T11:00:00.000Z");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2027-12-31", 1)).toBe("2028-01-01");
  });
});

describe("iCalendar text", () => {
  it("escapes special characters", () => {
    expect(escapeText("a,b;c\\d\nE")).toBe("a\\,b\\;c\\\\d\\nE");
  });

  it("folds long lines at 75 octets without splitting UTF-8 characters", () => {
    const folded = foldLine(`SUMMARY:${"ä".repeat(60)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, p] of parts.entries()) {
      expect(Buffer.byteLength(p, "utf8")).toBeLessThanOrEqual(75);
      if (i > 0) expect(p.startsWith(" ")).toBe(true);
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(`SUMMARY:${"ä".repeat(60)}`);
  });
});

describe("renderCalendar", () => {
  it("renders all-day events with exclusive DATE end", () => {
    const ics = renderCalendar({ name: "BSV-SWS – Schwimmen", description: "x", events: [base] });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20270508");
    expect(ics).toContain("DTEND;VALUE=DATE:20270510");
    expect(ics).toContain("UID:abc@bsv-sws.de");
    expect(ics).toContain("LOCATION:Stadtbad\\, Badstraße 1\\, 09111 Chemnitz");
    expect(ics).toContain("CATEGORIES:Schwimmen,Wettkampf");
    expect(ics).not.toMatch(/[^\r]\n/); // CRLF only
  });

  it("renders timed events in UTC", () => {
    const ics = renderCalendar({
      name: "n",
      description: "d",
      events: [
        { ...base, allDay: false, startTime: "09:00", endTime: "17:30", endDate: "2027-05-08" },
      ],
    });
    expect(ics).toContain("DTSTART:20270508T070000Z");
    expect(ics).toContain("DTEND:20270508T153000Z");
  });

  it("renders an empty calendar", () => {
    expect(renderCalendar({ name: "n", description: "d", events: [] })).not.toContain("VEVENT");
  });
});
