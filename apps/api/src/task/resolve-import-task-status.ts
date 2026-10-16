import { toSlug } from "../column/to-slug";
import { coerceStatus, VIRTUAL_STATUSES } from "./validate-task-fields";

export function resolveImportTaskStatus(
  status: string,
  columns: { slug: string; name: string }[],
): { status: string; warning?: string } | { error: string } {
  const validStatuses = [
    ...columns.map((column) => column.slug),
    ...VIRTUAL_STATUSES,
  ];
  // Persisted slugs and virtual statuses take precedence over display names.
  if (validStatuses.includes(status)) return { status };

  let matches = columns.filter((column) => column.name === status);
  if (matches.length === 0) {
    const alias = toSlug(status);
    matches = alias
      ? columns.filter((column) => toSlug(column.name) === alias)
      : [];
  }
  const [match] = matches;
  if (matches.length === 1 && match) return { status: match.slug };
  if (matches.length > 1) {
    return {
      error: `Ambiguous status "${status}". Use the column's stored slug.`,
    };
  }
  return coerceStatus(status, validStatuses);
}
