import type { ImportedColumn } from "@kaneo/importers";
import { toSlug } from "../../column/controllers/create-column";
import { VIRTUAL_STATUSES } from "../../task/validate-task-fields";

export type PlannedImportColumn = {
  key: string;
  name: string;
  slug: string;
  position: number;
  isFinal: boolean;
};

export type ImportColumnPlan = {
  columns: PlannedImportColumn[];
  warnings: string[];
};

const UNTITLED_COLUMN = "Untitled";

function isReserved(slug: string) {
  return (VIRTUAL_STATUSES as readonly string[]).includes(slug);
}

function baseName(original: string) {
  const name = toSlug(original) ? original : UNTITLED_COLUMN;
  return isReserved(toSlug(name)) ? `${name} list` : name;
}

export function planImportColumns(
  columns: readonly ImportedColumn[],
): ImportColumnPlan {
  const usedSlugs = new Set<string>();
  const planned: PlannedImportColumn[] = [];
  const renamed: string[] = [];

  for (const column of columns) {
    const original = column.name.trim();
    const base = baseName(original);
    let name = base;
    for (let suffix = 2; usedSlugs.has(toSlug(name)); suffix++) {
      name = `${base} ${suffix}`;
    }

    const slug = toSlug(name);
    usedSlugs.add(slug);
    if (original && name !== original) {
      renamed.push(`"${original}" to "${name}"`);
    }

    planned.push({
      key: column.key,
      name,
      slug,
      position: planned.length,
      isFinal: column.isFinal,
    });
  }

  return {
    columns: planned,
    warnings:
      renamed.length > 0
        ? [
            `Renamed ${renamed.length === 1 ? "a column" : `${renamed.length} columns`} to avoid conflicts: ${renamed.join(", ")}.`,
          ]
        : [],
  };
}
