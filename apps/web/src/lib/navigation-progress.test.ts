import { describe, expect, it } from "vitest";
import { isTrackedNavigation } from "./navigation-progress";

const click = {
  defaultPrevented: true,
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};
const link = (href: string, extra: Partial<{ target: string; hasDownload: boolean }> = {}) => ({
  href,
  target: "",
  hasDownload: false,
  ...extra,
});
const here = "https://bsv-sws.de/veranstaltungen?ansicht=monat";

describe("isTrackedNavigation", () => {
  it("tracks client navigations to another page or query", () => {
    expect(isTrackedNavigation(click, link("/aktuelles"), here)).toBe(true);
    expect(isTrackedNavigation(click, link("/veranstaltungen?ansicht=jahr"), here)).toBe(true);
  });

  it("ignores native and same-page navigations", () => {
    expect(isTrackedNavigation({ ...click, defaultPrevented: false }, link("/a"), here)).toBe(
      false,
    );
    expect(isTrackedNavigation({ ...click, metaKey: true }, link("/a"), here)).toBe(false);
    expect(isTrackedNavigation({ ...click, button: 1 }, link("/a"), here)).toBe(false);
    expect(isTrackedNavigation(click, link("/a", { target: "_blank" }), here)).toBe(false);
    expect(isTrackedNavigation(click, link("/a", { hasDownload: true }), here)).toBe(false);
    expect(isTrackedNavigation(click, link("https://app.swimresults.de/m/X"), here)).toBe(false);
    expect(isTrackedNavigation(click, link("/veranstaltungen?ansicht=monat#mai"), here)).toBe(
      false,
    );
    expect(isTrackedNavigation(click, null, here)).toBe(false);
  });
});
