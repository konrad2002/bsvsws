import { describe, expect, it } from "vitest";
import { findDestructiveChanges } from "./schema-diff.js";

describe("findDestructiveChanges", () => {
  it("flags whole-item deletions", () => {
    const diff = {
      collections: [{ collection: "clubs", diff: [{ kind: "D" as const }] }],
      fields: [{ collection: "clubs", field: "name", diff: [{ kind: "D" as const, path: [] }] }],
      relations: [],
    };
    expect(findDestructiveChanges(diff)).toEqual(["collections: clubs", "fields: clubs.name"]);
  });

  it("ignores additions and nested property edits", () => {
    const diff = {
      collections: [{ collection: "clubs", diff: [{ kind: "N" as const }] }],
      fields: [
        {
          collection: "clubs",
          field: "name",
          diff: [{ kind: "D" as const, path: ["meta", "note"] }],
        },
      ],
      relations: [],
    };
    expect(findDestructiveChanges(diff)).toEqual([]);
  });
});
