/** Helpers to inspect a Directus schema diff before applying it. */

interface DeepDiffEntry {
  kind: "N" | "D" | "E" | "A";
  path?: (string | number)[];
}

interface DiffItem {
  collection: string;
  field?: string;
  related_collection?: string | null;
  diff: DeepDiffEntry[];
}

export interface SchemaDiff {
  collections: DiffItem[];
  fields: DiffItem[];
  relations: DiffItem[];
}

const label = (item: DiffItem) =>
  [item.collection, item.field, item.related_collection].filter(Boolean).join(".");

/** Lists collections/fields/relations that the diff would delete entirely. */
export function findDestructiveChanges(diff: SchemaDiff): string[] {
  const destructive: string[] = [];
  for (const [kind, items] of Object.entries(diff) as [keyof SchemaDiff, DiffItem[]][]) {
    for (const item of items ?? []) {
      if (item.diff.some((d) => d.kind === "D" && (!d.path || d.path.length === 0))) {
        destructive.push(`${kind}: ${label(item)}`);
      }
    }
  }
  return destructive;
}

export function summarizeDiff(diff: SchemaDiff): string[] {
  const out: string[] = [];
  for (const [kind, items] of Object.entries(diff) as [keyof SchemaDiff, DiffItem[]][]) {
    for (const item of items ?? []) {
      const kinds = [...new Set(item.diff.map((d) => d.kind))].join("");
      out.push(`${kind}: ${label(item)} [${kinds}]`);
    }
  }
  return out;
}
