import type { ImportedLabel } from "../types.js";
import type { LinearIssue, LinearLabel } from "./client.js";

export const FALLBACK_COLOR = "#6b7280";

export function toHexColor(color: string | null | undefined): string {
  const value = color?.trim().toLowerCase() ?? "";
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value);
  if (!short) return FALLBACK_COLOR;
  const [, red, green, blue] = short;
  return `#${red}${red}${green}${green}${blue}${blue}`;
}

export function mapLabels(issues: LinearIssue[]): ImportedLabel[] {
  const used = new Map<string, LinearLabel>();
  for (const issue of issues) {
    for (const label of issue.labels.nodes) {
      if (!used.has(label.id)) used.set(label.id, label);
    }
  }

  const nameCounts = new Map<string, number>();
  for (const label of used.values()) {
    const name = comparableName(label.name);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  return [...used.values()]
    .map((label) => ({
      key: label.id,
      name: labelName(
        label,
        (nameCounts.get(comparableName(label.name)) ?? 0) > 1,
      ),
      color: toHexColor(label.color),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function labelName(label: LinearLabel, ambiguous: boolean): string {
  const name = label.name.trim();
  const parent = label.parent?.name.trim();
  return ambiguous && parent ? `${parent}: ${name}` : name;
}

function comparableName(name: string): string {
  return name.trim().toLowerCase();
}
