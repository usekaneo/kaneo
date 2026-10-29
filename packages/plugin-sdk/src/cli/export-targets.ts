export type ExportTarget = {
  key: string;
  target: string;
};

function collect(key: string, value: unknown, targets: ExportTarget[]) {
  if (typeof value === "string") {
    if (!value.includes("*")) targets.push({ key, target: value });
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(key, item, targets);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const nested of Object.values(value)) collect(key, nested, targets);
  }
}

export function listExportTargets(exportsField: unknown): ExportTarget[] {
  const targets: ExportTarget[] = [];
  if (typeof exportsField === "string") {
    collect(".", exportsField, targets);
    return targets;
  }
  if (typeof exportsField !== "object" || exportsField === null) return targets;
  for (const [key, value] of Object.entries(exportsField)) {
    collect(key, value, targets);
  }
  return targets;
}
