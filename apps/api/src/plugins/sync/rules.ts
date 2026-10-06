import { z } from "zod";

const labelSelection = z.object({
  mode: z.literal("labels"),
  match: z.enum(["any", "all"]),
  labels: z
    .array(z.string().trim().min(1).max(128))
    .min(1)
    .max(50)
    .refine(
      (labels) => new Set(labels).size === labels.length,
      "Labels must be unique",
    ),
});

export const labelRuleSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  labelSelection,
]);

export const syncRulesSchema = z.object({
  outgoing: labelRuleSchema.describe(
    "Kaneo workspace label IDs controlling task sync. Missing labels pause sync.",
  ),
  incoming: labelRuleSchema.describe(
    "Exact repository label names controlling which issues can be imported.",
  ),
});

export type LabelRule = z.infer<typeof labelRuleSchema>;
export type SyncRules = z.infer<typeof syncRulesSchema>;
export const defaultSyncRules: SyncRules = {
  outgoing: { mode: "all" },
  incoming: { mode: "all" },
};
export const syncProviders = ["github", "gitea", "gitlab"] as const;

export function readSyncRules(
  config: string | Record<string, unknown>,
): SyncRules | null {
  try {
    const parsed = typeof config === "string" ? JSON.parse(config) : config;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.syncRules === undefined) return defaultSyncRules;
    const result = syncRulesSchema.safeParse(parsed.syncRules);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function matchesLabels(
  rule: LabelRule,
  labels: readonly string[],
): boolean {
  if (rule.mode === "all") return true;
  if (!rule.labels.length) return false;
  const present = new Set(labels);
  return rule.match === "all"
    ? rule.labels.every((label) => present.has(label))
    : rule.labels.some((label) => present.has(label));
}

export function issueLabelNames(labels: unknown): string[] {
  if (!Array.isArray(labels)) return [];
  return labels.flatMap((label) => {
    if (typeof label === "string") return [label];
    if (label && typeof label === "object") {
      const name = label.name ?? label.title;
      return typeof name === "string" ? [name] : [];
    }
    return [];
  });
}

export function acceptsIssue(
  config: string | Record<string, unknown>,
  labels: unknown,
): boolean {
  const rules = readSyncRules(config);
  return !!rules && matchesLabels(rules.incoming, issueLabelNames(labels));
}

export function isSyncPaused(metadata: string | null): boolean {
  try {
    return JSON.parse(metadata ?? "{}").syncFilterPaused === true;
  } catch {
    return false;
  }
}
