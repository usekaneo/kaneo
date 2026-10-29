import type {
  PluginProjectColumn,
  TranslateFunction,
} from "@kaneo/plugin-sdk/web";

function toDisplayCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function statusLabel(
  status: string,
  columns: readonly PluginProjectColumn[],
  t: TranslateFunction,
): string {
  const column = columns.find((candidate) => candidate.slug === status);
  if (column) return column.name;
  if (status === "planned") return t("status.planned");
  return toDisplayCase(status);
}
