import type { WebPluginDefinition } from "@kaneo/plugin-sdk/web";

export const CONTRIBUTION_KINDS = [
  "projectViews",
  "taskPanels",
  "pages",
  "commands",
] as const;

export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

export type ContributionItem<K extends ContributionKind> = NonNullable<
  WebPluginDefinition[K]
>[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isComponent(value: unknown): boolean {
  return typeof value === "function" || isRecord(value);
}

function isContributionItem(kind: ContributionKind, value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id === "") return false;
  if (typeof value.title !== "string") return false;
  return kind === "commands"
    ? typeof value.run === "function"
    : isComponent(value.component);
}

function normalizeItems(kind: ContributionKind, value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item) => {
    if (!isContributionItem(kind, item)) return false;
    const id = (item as { id: string }).id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function normalizeWebDefinition(
  definition: WebPluginDefinition,
): WebPluginDefinition {
  const normalized: Record<string, unknown> = { ...definition };
  for (const kind of CONTRIBUTION_KINDS) {
    normalized[kind] = normalizeItems(kind, definition[kind]);
  }
  if (!isComponent(definition.settingsPanel)) {
    normalized.settingsPanel = undefined;
  }
  if (!isRecord(definition.translations)) {
    normalized.translations = undefined;
  }
  return normalized as WebPluginDefinition;
}
