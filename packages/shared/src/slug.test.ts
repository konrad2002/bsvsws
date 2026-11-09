import { describe, expect, it } from "vitest";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it.each([
    ["Südwest-Pokal 2027", "suedwest-pokal-2027"],
    ["Bezirksmeisterschaften „Lange Strecke“", "bezirksmeisterschaften-lange-strecke"],
    ["Größe & Maß", "groesse-mass"],
    ["  Crème brûlée!!  ", "creme-brulee"],
    ["---", ""],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("respects the maximum length without trailing hyphens", () => {
    expect(slugify("a".repeat(10) + " " + "b".repeat(10), 11)).toBe("aaaaaaaaaa");
  });
});
