import { canSyncGiteaIssues } from "../config";
import { createGiteaClient, type GiteaLabel } from "./gitea-api";
import { withGiteaOutboundWrite } from "../services/outbound-fence";

type OutboundBinding = Parameters<typeof withGiteaOutboundWrite>[0];

export type GiteaLabelWriteOutcome =
  | { outcome: "completed" }
  | { outcome: "skipped" }
  | { outcome: "failed" };

const labelColors: Record<string, string> = {
  "priority:low": "0EA5E9",
  "priority:medium": "EAB308",
  "priority:high": "F97316",
  "priority:urgent": "EF4444",
  "status:to-do": "6B7280",
  "status:in-progress": "3B82F6",
  "status:in-review": "8B5CF6",
  "status:done": "10B981",
  "status:planned": "8B5CF6",
  "status:archived": "6B7280",
};

function getLabelColor(labelName: string): string {
  return labelColors[labelName] || "6B7280";
}

export async function ensureLabelsExistGitea(
  binding: OutboundBinding,
  labels: string[],
): Promise<
  | { outcome: "completed"; value: Map<string, number> }
  | { outcome: "skipped" }
  | { outcome: "failed" }
> {
  const { config } = binding;
  if (!canSyncGiteaIssues(config)) return { outcome: "skipped" };
  try {
    const client = createGiteaClient(config);
    const { repositoryOwner, repositoryName } = config;
    const existingLabels = await client.listLabels(
      repositoryOwner,
      repositoryName,
    );
    const nameToId = new Map(
      existingLabels.map((label) => [label.name, label.id]),
    );
    const map = new Map<string, number>();
    for (const name of labels) {
      const existingId = nameToId.get(name);
      if (existingId !== undefined) {
        map.set(name, existingId);
        continue;
      }
      const result = await withGiteaOutboundWrite(binding, () =>
        client.createLabel(
          repositoryOwner,
          repositoryName,
          name,
          getLabelColor(name),
        ),
      );
      if (!result.sent) return { outcome: "skipped" };
      nameToId.set(name, result.value.id);
      map.set(name, result.value.id);
    }
    return { outcome: "completed", value: map };
  } catch (error) {
    console.error("Failed to ensure Gitea labels exist:", error);
    return { outcome: "failed" };
  }
}

export async function addLabelsToIssueGitea(
  binding: OutboundBinding,
  issueIndex: number,
  labelNames: string[],
): Promise<GiteaLabelWriteOutcome> {
  const { config } = binding;
  if (!canSyncGiteaIssues(config)) return { outcome: "skipped" };
  if (!labelNames.length) return { outcome: "completed" };
  const ensured = await ensureLabelsExistGitea(binding, labelNames);
  if (ensured.outcome !== "completed") return ensured;
  const ids = labelNames.map((name) => ensured.value.get(name)!);
  try {
    const client = createGiteaClient(config);
    // Keep each fence to one HTTP request, including large label batches.
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const result = await withGiteaOutboundWrite(binding, () =>
        client.addLabelsToIssue(
          config.repositoryOwner,
          config.repositoryName,
          issueIndex,
          chunk,
        ),
      );
      if (!result.sent) return { outcome: "skipped" };
    }
    return { outcome: "completed" };
  } catch (error) {
    console.error("Failed to add labels to Gitea issue:", error);
    return { outcome: "failed" };
  }
}

export async function removeLabelGitea(
  binding: OutboundBinding,
  issueIndex: number,
  labelName: string,
): Promise<GiteaLabelWriteOutcome> {
  const { config } = binding;
  if (!canSyncGiteaIssues(config)) return { outcome: "skipped" };
  try {
    const client = createGiteaClient(config);
    const labels: GiteaLabel[] = await client.listLabels(
      config.repositoryOwner,
      config.repositoryName,
    );
    const label = labels.find((entry) => entry.name === labelName);
    if (!label) return { outcome: "completed" };
    const result = await withGiteaOutboundWrite(binding, () =>
      client.removeLabelFromIssue(
        config.repositoryOwner,
        config.repositoryName,
        issueIndex,
        label.id,
      ),
    );
    return { outcome: result.sent ? "completed" : "skipped" };
  } catch (error) {
    console.error(
      `Failed to remove label "${labelName}" from Gitea issue:`,
      error,
    );
    return { outcome: "failed" };
  }
}
