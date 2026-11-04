import { describe, expect, it } from "vitest";
import {
  eventsByDay,
  monthGrid,
  monthRange,
  parseMonth,
  parseYear,
  shiftMonth,
  todayInBerlin,
} from "./calendar";

describe("calendar helpers", () => {
  it("builds Monday-first month grids", () => {
    const grid = monthGrid(2027, 2); // Feb 2027 starts on a Monday, 28 days
    expect(grid).toHaveLength(4);
    expect(grid[0]![0]).toEqual({ date: "2027-02-01", day: 1, inMonth: true });
    const may = monthGrid(2027, 5); // May 2027 starts on a Saturday
    expect(may[0]![0]).toEqual({ date: "2027-04-26", day: 26, inMonth: false });
    expect(may[0]![5]).toMatchObject({ date: "2027-05-01", inMonth: true });
    expect(may.every((w) => w.length === 7)).toBe(true);
    expect(may.flat().filter((d) => d.inMonth)).toHaveLength(31);
  });

  it("computes ranges and navigation", () => {
    expect(monthRange(2028, 2)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(shiftMonth(2027, 1, -1)).toEqual({ year: 2026, month: 12 });
    expect(shiftMonth(2027, 12, 1)).toEqual({ year: 2028, month: 1 });
  });

  it("parses user input defensively", () => {
    expect(parseMonth("2027-05", "2026-11-04")).toEqual({ year: 2027, month: 5 });
    expect(parseMonth("2027-13", "2026-11-04")).toEqual({ year: 2026, month: 11 });
    expect(parseMonth(undefined, "2026-11-04")).toEqual({ year: 2026, month: 11 });
    expect(parseYear("2027", 2026)).toBe(2027);
    expect(parseYear("abc", 2026)).toBe(2026);
  });

  it("expands multi-day events and clips them to the range", () => {
    const map = eventsByDay(
      [
        { id: "a", startDate: "2027-04-30", endDate: "2027-05-02" },
        { id: "b", startDate: "2027-05-02", endDate: "2027-05-02" },
      ],
      "2027-05-01",
      "2027-05-31",
    );
    expect(map.get("2027-04-30")).toBeUndefined();
    expect(map.get("2027-05-01")?.map((e) => e.id)).toEqual(["a"]);
    expect(map.get("2027-05-02")?.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("uses the Berlin date for 'today'", () => {
    expect(todayInBerlin(new Date("2027-05-07T22:30:00Z"))).toBe("2027-05-08"); // 00:30 CEST
  });
});
