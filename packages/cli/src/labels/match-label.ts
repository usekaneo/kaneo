import type { Label } from "../api/labels.js";

export type LabelMatch =
  | { readonly kind: "found"; readonly label: Label }
  | { readonly kind: "ambiguous"; readonly candidates: ReadonlyArray<Label> }
  | { readonly kind: "none" };

export function normalizeLabelName(name: string): string {
  return name.normalize("NFKC").trim().toLowerCase();
}

export function workspaceLabels(
  labels: ReadonlyArray<Label>,
): ReadonlyArray<Label> {
  return labels.filter((label) => label.taskId === null);
}

export function matchLabel(
  labels: ReadonlyArray<Label>,
  reference: string,
): LabelMatch {
  const trimmed = reference.trim();
  const byId = labels.find((label) => label.id === trimmed);
  if (byId) return { kind: "found", label: byId };
  const wanted = normalizeLabelName(reference);
  const named = labels.filter(
    (label) => normalizeLabelName(label.name) === wanted,
  );
  const exact = named.filter((label) => label.name.trim() === trimmed);
  const [first] = named;
  if (!first) return { kind: "none" };
  if (named.length === 1) return { kind: "found", label: first };
  const [exactOnly] = exact;
  if (exact.length === 1 && exactOnly) {
    return { kind: "found", label: exactOnly };
  }
  return { kind: "ambiguous", candidates: named };
}

export function labelUsage(
  labels: ReadonlyArray<Label>,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const label of labels) {
    if (label.taskId === null) continue;
    counts.set(label.name, (counts.get(label.name) ?? 0) + 1);
  }
  return counts;
}

export type NameClash =
  | { readonly kind: "workspace"; readonly label: Label }
  | { readonly kind: "task" };

export function findNameClash(
  labels: ReadonlyArray<Label>,
  name: string,
  except?: Label,
): NameClash | null {
  const wanted = normalizeLabelName(name);
  const clash = workspaceLabels(labels).find(
    (label) =>
      label.id !== except?.id && normalizeLabelName(label.name) === wanted,
  );
  if (clash) return { kind: "workspace", label: clash };
  if (!except || except.name === name) return null;
  const tasksWithOld = new Set(
    labels
      .filter((label) => label.taskId !== null && label.name === except.name)
      .map((label) => label.taskId),
  );
  const sharesTask = labels.some(
    (label) =>
      label.taskId !== null &&
      label.name === name &&
      tasksWithOld.has(label.taskId),
  );
  return sharesTask ? { kind: "task" } : null;
}

export function quoteName(name: string): string {
  return /^[\p{L}\p{N}._-]+$/u.test(name) ? name : `"${name}"`;
}
